"""Backtest: replay one week twice and compare.

Baseline: what really happened. Every fault lasts until the day it was really repaired (`end_date`).
Ours:     a fault is known the day the sensors flag it, or on its second driver report. One technician
          repairs one known fault per day, in action-list order, and the charger works again the next day.
A fault we never notice still ends on its real repair day, as in the baseline.
"""

from datetime import date, timedelta
from typing import Any

import pandas as pd

from app.core.errors import ApiError
from app.services.classifier import charge_min
from app.services.data_loader import DataStore
from app.services.priority import MIN_REPORTS, build_action_list
from app.services.queueing import lost_sessions, predict_wait

WEEK_DAYS = 7


def backtest_days(data: DataStore) -> list[date]:
    """Seven days starting the day before the first real fault, so both ways of working are tested."""
    first = data.forecasts["slot_start"].min().date()
    last = data.forecasts["slot_start"].max().date()
    faults = data.fault_labels["start_date"]
    start = max(first, faults.min() - timedelta(days=1)) if len(faults) else first
    return [start + timedelta(days=d) for d in range(WEEK_DAYS) if start + timedelta(days=d) <= last]


def _flagged_dates(data: DataStore) -> dict[str, date]:
    """First day the health model marks each charger as not healthy."""
    faulty = data.health[data.health["status"] != "healthy"]
    return faulty.groupby("charger_id")["date"].min().to_dict()


def _known_from(data: DataStore, reports: pd.DataFrame, fault: dict[str, Any]) -> date | None:
    """The day we learn of a fault: the sensors flag the charger, or drivers report it a second time."""
    charger_id, start, end = fault["charger_id"], fault["start_date"], fault["end_date"]
    found = []
    health = data.health_by_charger.get(charger_id)
    if health is not None:
        flagged = health[(health["status"] != "healthy") & health["date"].between(start, end)]
        found.extend(flagged["date"].head(1))
    report_days = reports.loc[reports["charger_id"] == charger_id, "reported_at"].dt.date
    during = sorted(day for day in report_days if start <= day <= end)
    if len(during) >= MIN_REPORTS:
        found.append(during[MIN_REPORTS - 1])
    return min(found) if found else None


def real_faults(data: DataStore, days: list[date]) -> list[dict[str, Any]]:
    """The real faults that touch these days: charger, first day, repair day, and the day we learn of it."""
    labels = data.fault_labels
    if "end_date" not in labels.columns:  # no repair day given: the fault outlasts the week
        labels = labels.assign(end_date=days[-1])
    touching = labels[(labels["start_date"] <= days[-1]) & (labels["end_date"] >= days[0])]
    faults = touching[["charger_id", "start_date", "end_date"]].to_dict("records")
    reports = pd.concat([data.user_reports, data.site_reports])
    for fault in faults:
        fault["known_from"] = _known_from(data, reports, fault)
    return faults


def _queues(data: DataStore, days: list[date], down_by_day: list[set[str]]) -> list[dict[str, Any]]:
    """The queues on each day, given which chargers are down that day."""
    slot_days = data.forecasts["slot_start"].dt.date
    results = []
    for day, down in zip(days, down_by_day):
        queue_minutes = lost = arrivals_total = 0.0
        for station in data.stations.itertuples():
            n_working = station.n_chargers - sum(c.startswith(f"{station.station_id}_c") for c in down)
            today = data.forecasts[(data.forecasts["station_id"] == station.station_id) & (slot_days == day)]
            avg_charge_min = charge_min(data, station.station_id)
            for arrivals in today["arrivals"]:
                wait = predict_wait(arrivals, avg_charge_min, n_working)
                queue_minutes += arrivals * wait
                lost += lost_sessions(arrivals, wait, data.params["max_tolerable_wait_min"])
                arrivals_total += arrivals
        results.append({"date": day, "queue_minutes": queue_minutes, "lost": lost, "arrivals": arrivals_total})
    return results


def run_baseline(data: DataStore, days: list[date]) -> list[dict[str, Any]]:
    """What really happened: each charger is down from the day its fault starts to the day it was repaired."""
    faults = real_faults(data, days)
    down_by_day = [{f["charger_id"] for f in faults if f["start_date"] <= day <= f["end_date"]} for day in days]
    return _queues(data, days, down_by_day)


def run_ours(data: DataStore, days: list[date]) -> list[dict[str, Any]]:
    """Act the day a fault is known: one repair per day, in action-list order."""
    timezone = data.forecasts["slot_start"].dt.tz
    faults = real_faults(data, days)
    repaired: list[dict[str, Any]] = []
    down_by_day = []
    for day in days:
        active = [f for f in faults if f["start_date"] <= day <= f["end_date"] and f not in repaired]
        down_by_day.append({f["charger_id"] for f in active})

        known = [f for f in active if f["known_from"] is not None and f["known_from"] <= day]
        if known:
            evening = pd.Timestamp(f"{day} 23:30", tz=timezone).to_pydatetime()
            ranked = [a["charger_id"] for a in build_action_list(data, evening)]
            known.sort(key=lambda f: ranked.index(f["charger_id"]) if f["charger_id"] in ranked else len(ranked))
            repaired.append(known[0])
    return _queues(data, days, down_by_day)


def _forecast_errors(data: DataStore, days: list[date]) -> tuple[float, float]:
    """Mean absolute error of the model and of "same slot last week", against what really happened."""
    week = data.forecasts[data.forecasts["slot_start"].dt.date.isin(days)]
    if "arrivals_actual" not in week.columns:
        raise ApiError(500, "forecasts.parquet has no arrivals_actual column, so the backtest cannot run")
    ours = (week["arrivals"] - week["arrivals_actual"]).abs().mean()
    baseline = (week["arrivals_baseline"] - week["arrivals_actual"]).abs().mean()
    return round(float(ours), 2), round(float(baseline), 2)


def compare(data: DataStore, days: list[date], baseline: list[dict], ours: list[dict]) -> dict[str, Any]:
    flagged = set(_flagged_dates(data))
    real = set(data.fault_labels["charger_id"])
    mae_ours, mae_baseline = _forecast_errors(data, days)
    return {
        "week_label": f"Week of {days[0]:%d %b %Y}",
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


_cache: dict[int, dict[str, Any]] = {}  # the data never changes after startup, so run once


def run_backtest(data: DataStore) -> dict[str, Any]:
    if id(data) not in _cache:
        days = backtest_days(data)
        _cache[id(data)] = compare(data, days, run_baseline(data, days), run_ours(data, days))
    return _cache[id(data)]
