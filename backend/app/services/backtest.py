"""Backtest: replay one festive week twice and compare.

Baseline: a fault is known only when drivers report it, and faults are fixed first come, first served.
Ours:     a fault is known the day the sensors flag it (or drivers report it twice), and faults are
          fixed in action-list order.
Both have one technician, who repairs one charger per day (working again the next day).
"""

from datetime import date, timedelta
from typing import Any

import pandas as pd

from app.core.errors import ApiError
from app.services.data_loader import DataStore
from app.services.priority import MIN_REPORTS, build_action_list
from app.services.queueing import lost_sessions, predict_wait

WEEK_DAYS = 7
DAYS_BEFORE_FESTIVE = 4  # the week starts this many days before the first festive period
REPORT_DELAY_DAYS = 2  # assumption for a fault nobody reported: it is noticed two days after it starts


def backtest_days(data: DataStore) -> list[date]:
    first = data.forecasts["slot_start"].min().date()
    last = data.forecasts["slot_start"].max().date()
    periods = data.meta["festive_periods"]
    festive_start = pd.Timestamp(periods[0]["start"]).date() if periods else first
    start = max(first, festive_start - timedelta(days=DAYS_BEFORE_FESTIVE))
    return [start + timedelta(days=d) for d in range(WEEK_DAYS) if start + timedelta(days=d) <= last]


def _flagged_dates(data: DataStore) -> dict[str, date]:
    """First day the health model marks each charger as not healthy."""
    faulty = data.health[data.health["status"] != "healthy"]
    return faulty.groupby("charger_id")["date"].min().to_dict()


def _simulate(data: DataStore, days: list[date], known_from: dict[str, date], pick) -> list[dict[str, Any]]:
    """Day by day: which chargers are down, the queues that causes, then one repair."""
    fault_start = dict(zip(data.fault_labels["charger_id"], data.fault_labels["start_date"]))
    slot_days = data.forecasts["slot_start"].dt.date
    repaired: set[str] = set()
    results = []

    for day in days:
        down = [c for c, start in fault_start.items() if start <= day and c not in repaired]
        queue_minutes = lost = arrivals_total = 0.0
        for station in data.stations.itertuples():
            n_working = station.n_chargers - sum(c.startswith(f"{station.station_id}_c") for c in down)
            today = data.forecasts[(data.forecasts["station_id"] == station.station_id) & (slot_days == day)]
            for arrivals in today["arrivals"]:
                wait = predict_wait(arrivals, data.params["avg_charge_min"], n_working)
                queue_minutes += arrivals * wait
                lost += lost_sessions(arrivals, wait, data.params["max_tolerable_wait_min"])
                arrivals_total += arrivals
        results.append({"date": day, "queue_minutes": queue_minutes, "lost": lost, "arrivals": arrivals_total})

        known = [c for c, since in known_from.items() if since <= day and c not in repaired]
        if known:
            repaired.add(pick(known, day))
    return results


def _report_dates(data: DataStore, nth: int) -> dict[str, date]:
    """Day of each charger's nth driver report."""
    rows = data.user_reports.groupby("charger_id").nth(nth - 1)
    return dict(zip(rows["charger_id"], rows["reported_at"].dt.date))


def run_baseline(data: DataStore, days: list[date]) -> list[dict[str, Any]]:
    """Wait for drivers to report, then fix first come, first served."""
    first_report = _report_dates(data, nth=1)
    reported = {
        c: first_report.get(c, start + timedelta(days=REPORT_DELAY_DAYS))
        for c, start in zip(data.fault_labels["charger_id"], data.fault_labels["start_date"])
    }
    return _simulate(data, days, reported, pick=lambda known, day: min(known, key=reported.get))


def run_ours(data: DataStore, days: list[date]) -> list[dict[str, Any]]:
    """Act on sensor flags as well as driver reports, and fix in action-list order."""
    timezone = data.forecasts["slot_start"].dt.tz
    known_from = {**_report_dates(data, nth=MIN_REPORTS), **_flagged_dates(data)}

    def by_priority(known: list[str], day: date) -> str:
        evening = pd.Timestamp(f"{day} 23:30", tz=timezone).to_pydatetime()
        ranked = [a["charger_id"] for a in build_action_list(data, evening) if a["charger_id"] in known]
        return ranked[0] if ranked else known[0]

    return _simulate(data, days, known_from, pick=by_priority)


def _forecast_errors(data: DataStore, days: list[date]) -> tuple[float, float]:
    """Mean absolute error of the model and of "same slot last week", against what really happened."""
    week = data.forecasts[data.forecasts["slot_start"].dt.date.isin(days)]
    if "arrivals_actual" not in week.columns:
        raise ApiError(500, "forecasts.parquet has no arrivals_actual column, so the backtest cannot run")
    # arrivals_model is ML's raw prediction, when the demo forecast has a festive multiplier on top.
    model = week["arrivals_model"] if "arrivals_model" in week.columns else week["arrivals"]
    ours = (model - week["arrivals_actual"]).abs().mean()
    baseline = (week["arrivals_baseline"] - week["arrivals_actual"]).abs().mean()
    return round(float(ours), 2), round(float(baseline), 2)


def compare(data: DataStore, days: list[date], baseline: list[dict], ours: list[dict]) -> dict[str, Any]:
    flagged = set(_flagged_dates(data))
    real = set(data.fault_labels["charger_id"])
    mae_ours, mae_baseline = _forecast_errors(data, days)
    periods = data.meta["festive_periods"]
    return {
        "week_label": f"{periods[0]['name']} week" if periods else "Backtest week",
        "queue_minutes_saved": round(sum(b["queue_minutes"] - o["queue_minutes"] for b, o in zip(baseline, ours)), 1),
        "rm_protected": round(
            sum(b["lost"] - o["lost"] for b, o in zip(baseline, ours)) * data.params["rm_per_session"], 2
        ),
        "forecast_mae_ours": mae_ours,
        "forecast_mae_baseline": mae_baseline,
        "fault_precision": round(len(flagged & real) / len(flagged), 2) if flagged else 0.0,
        "fault_recall": round(len(flagged & real) / len(real), 2) if real else 0.0,
        "daily": [
            {
                "date": b["date"],
                "wait_baseline_min": round(b["queue_minutes"] / b["arrivals"], 1) if b["arrivals"] else 0.0,
                "wait_ours_min": round(o["queue_minutes"] / o["arrivals"], 1) if o["arrivals"] else 0.0,
            }
            for b, o in zip(baseline, ours)
        ],
    }


def run_backtest(data: DataStore) -> dict[str, Any]:
    days = backtest_days(data)
    return compare(data, days, run_baseline(data, days), run_ours(data, days))
