"""Builds the meta, station and charger responses from the loaded data."""

from datetime import datetime, timedelta
from typing import Any

import pandas as pd

from app.core.errors import not_found
from app.services.backtest import backtest_weeks
from app.services.classifier import charge_min, classify_charger, latest_health, recent_reports, working_chargers
from app.services.data_loader import DataStore
from app.services.priority import build_action_list, upcoming_slots
from app.services.queueing import SLOT_MIN, predict_wait


def wait_level(wait_min: float) -> str:
    """green < 15 min, amber 15-40, red > 40."""
    if wait_min < 15:
        return "green"
    return "amber" if wait_min <= 40 else "red"


def build_meta(data: DataStore) -> dict[str, Any]:
    slots = data.forecasts["slot_start"]
    return {
        **data.meta,
        "time_range": {"start": slots.min().isoformat(), "end": slots.max().isoformat()},
        "backtest_weeks": backtest_weeks(data),
        "assumptions": {
            "rm_per_session": data.params["rm_per_session"],
            "avg_charge_min": data.params["avg_charge_min"],
        },
    }


def _require_station(data: DataStore, station_id: str) -> None:
    if station_id not in set(data.stations["station_id"]):
        raise not_found(f"Station {station_id} does not exist")


def station_list(data: DataStore, time: datetime) -> list[dict[str, Any]]:
    actions = build_action_list(data, time)
    result = []
    for station in data.stations.itertuples():
        n_working = working_chargers(data, station.station_id, time)
        now = upcoming_slots(data, station.station_id, time, hours=1)
        arrivals = float(now["arrivals"].iloc[0]) if not now.empty else 0.0
        wait = predict_wait(arrivals, charge_min(data, station.station_id), n_working)
        result.append({
            "id": station.station_id, "name": station.name, "lat": station.lat, "lon": station.lon,
            "n_chargers": station.n_chargers, "n_working": n_working, "power_kw": station.power_kw,
            "predicted_wait_min": wait, "level": wait_level(wait),
            "open_issue_count": sum(
                a["station_id"] == station.station_id and a["charger_id"] not in data.repaired for a in actions
            ),
        })
    return result


def station_chargers(data: DataStore, station_id: str, time: datetime) -> list[dict[str, Any]]:
    """The station's chargers that have sensor data, in charger order. Ids are never built from n_chargers."""
    _require_station(data, station_id)
    power_kw = float(data.stations.loc[data.stations["station_id"] == station_id, "power_kw"].iloc[0])
    charger_ids = sorted(data.chargers_by_station.get(station_id, []), key=lambda c: int(c.rsplit("_c", 1)[-1]))
    return [
        {
            "charger_id": charger_id,
            "station_id": station_id,
            "power_kw": power_kw,
            "status": classify_charger(data, charger_id, time).value,
        }
        for charger_id in charger_ids
    ]


def charger_events(data: DataStore, charger_id: str, time: datetime, days: int) -> list[dict[str, Any]]:
    """The charger's log up to the simulated time, newest first: the proof behind its actions."""
    if charger_id not in data.health_by_charger:
        raise not_found(f"Charger {charger_id} does not exist")
    events = data.events_by_charger.get(charger_id)
    if events is None:
        return []
    recent = events[(events["time"] <= time) & (events["time"] > time - timedelta(days=days))]
    return recent.sort_values("time", ascending=False)[["time", "source", "message"]].to_dict("records")


def build_overview(data: DataStore, time: datetime) -> dict[str, Any]:
    """Network totals up to the simulated time, never beyond it: energy, live sessions, uptime."""
    week = [time.date() - timedelta(days=d) for d in range(6, -1, -1)]  # oldest first; the last one is today

    # Energy: only the 30-minute slots that have already ended.
    ended = data.energy[data.energy["slot_start"] + pd.Timedelta(minutes=SLOT_MIN) <= time]
    kwh_per_day = ended.groupby(ended["slot_start"].dt.date)["energy_kwh"].sum()
    trend = [{"date": day, "kwh": round(float(kwh_per_day.get(day, 0.0)), 1)} for day in week]

    live = (data.sessions["started_at"] <= time) & (data.sessions["ended_at"] > time)

    # Uptime is historical: the share of charger-days in the week on which the charger reported no fault.
    days = data.health[data.health["date"].isin(week)]
    uptime = 100.0 if days.empty else 100 * float((days["status"] == "healthy").mean())

    return {
        "data_source": "api",
        "energy_delivered_kwh": trend[-1]["kwh"],
        "energy_delivered_week_kwh": round(sum(point["kwh"] for point in trend), 1),
        "live_sessions": int(live.sum()),
        "network_uptime_pct": round(uptime, 1),
        "energy_trend": trend,
    }


def station_forecast(data: DataStore, station_id: str, start: datetime, hours: int) -> list[dict[str, Any]]:
    _require_station(data, station_id)
    n_working = working_chargers(data, station_id, start)
    slots = upcoming_slots(data, station_id, start, hours)
    return [
        {
            "slot_start": row.slot_start.to_pydatetime(),
            "arrivals": row.arrivals,
            "arrivals_baseline": row.arrivals_baseline,
            "wait_min": predict_wait(row.arrivals, charge_min(data, station_id), n_working),
            "is_festive": bool(row.is_festive),
        }
        for row in slots.itertuples()
    ]


def charger_health(data: DataStore, charger_id: str, time: datetime, days: int) -> dict[str, Any]:
    latest = latest_health(data, charger_id, time)
    if latest is None:
        raise not_found(f"Charger {charger_id} does not exist")

    today = time.date()
    history = data.health[(data.health["charger_id"] == charger_id) & (data.health["date"] <= today)]
    window = history[history["date"] > today - timedelta(days=days)]
    # A charger can recover and fail again, so "since" is the first faulty day after its last healthy one.
    healthy_days = history[history["status"] == "healthy"]["date"]
    faulty_days = history["date"] if healthy_days.empty else history[history["date"] > healthy_days.iloc[-1]]["date"]
    n_reports = len(recent_reports(data, charger_id, time))
    evidence = [*latest["evidence"], f"{n_reports} driver report(s) in the last 7 days"] if n_reports else latest["evidence"]
    return {
        "charger_id": charger_id,
        "station_id": latest["station_id"],
        "status": latest["status"],
        "p_fault": float(latest["p_fault"]),
        "evidence": evidence,
        "series": [
            {"date": row.date, "ratio": row.power_ratio, "baseline": row.baseline} for row in window.itertuples()
        ],
        "degraded_since": None if faulty_days.empty else faulty_days.iloc[0],
    }
