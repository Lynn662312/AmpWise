"""Builds the meta, station and charger responses from the loaded data."""

from datetime import datetime, timedelta
from typing import Any

from app.core.errors import not_found
from app.services.classifier import charge_min, latest_health, recent_reports, working_chargers
from app.services.data_loader import DataStore
from app.services.priority import build_action_list, upcoming_slots
from app.services.queueing import predict_wait


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
        "assumptions": {
            "rm_per_session": data.params["rm_per_session"],
            "max_tolerable_wait_min": data.params["max_tolerable_wait_min"],
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
            "open_issue_count": sum(a["station_id"] == station.station_id for a in actions),
        })
    return result


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
