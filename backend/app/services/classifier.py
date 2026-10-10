"""Turns forecasts and health results into issue types (docs/api_contract.md section 2)."""

from datetime import datetime, timedelta

import pandas as pd

from app.schemas import ChargerStatus, IssueType
from app.services.data_loader import DataStore
from app.services.queueing import predict_wait

LOOKAHEAD_HOURS = 24
RED_WAIT_MIN = 40.0  # same limit as WaitLevel "red"
UNDERUSED_UTILISATION = 0.10  # assumption: under 10% busy over the next day
REPORT_WINDOW_DAYS = 7  # assumption: driver reports older than a week are ignored


def latest_health(data: DataStore, charger_id: str, time: datetime) -> pd.Series | None:
    """The charger's health row on or before the simulated day."""
    rows = data.health_by_charger.get(charger_id)
    if rows is None:
        return None
    rows = rows[rows["date"] <= time.date()]
    return None if rows.empty else rows.iloc[-1]


def charge_min(data: DataStore, station_id: str) -> float:
    """Average charge time: the station's own value when ML provides one, else the shared assumption."""
    if "avg_charge_min" in data.stations.columns:
        return float(data.stations.loc[data.stations["station_id"] == station_id, "avg_charge_min"].iloc[0])
    return data.params["avg_charge_min"]


def recent_reports(data: DataStore, charger_id: str, time: datetime) -> pd.Series:
    """Times drivers reported this charger in the last week, earliest first."""
    reports = data.reports_by_charger.get(charger_id)
    if reports is None:
        return data.user_reports["reported_at"].iloc[:0]
    recent = (reports["reported_at"] <= time) & (reports["reported_at"] > time - timedelta(days=REPORT_WINDOW_DAYS))
    return reports.loc[recent, "reported_at"]


def classify_charger(data: DataStore, charger_id: str, time: datetime) -> ChargerStatus:
    row = latest_health(data, charger_id, time)
    return ChargerStatus.healthy if row is None else ChargerStatus(row["status"])


def working_chargers(data: DataStore, station_id: str, time: datetime) -> int:
    """Chargers at the station that are not flagged faulty."""
    charger_ids = data.chargers_by_station.get(station_id, [])
    faulty = sum(classify_charger(data, c, time) != ChargerStatus.healthy for c in charger_ids)
    n_chargers = int(data.stations.loc[data.stations["station_id"] == station_id, "n_chargers"].iloc[0])
    return n_chargers - faulty


def classify_station(data: DataStore, station_id: str, time: datetime) -> IssueType | None:
    """Station-level issue over the next 24 hours, or None if the station is fine."""
    forecasts = data.forecasts
    slots = forecasts[
        (forecasts["station_id"] == station_id)
        & (forecasts["slot_start"] >= time)
        & (forecasts["slot_start"] < time + timedelta(hours=LOOKAHEAD_HOURS))
    ]
    if slots.empty:
        return None

    avg_charge_min = charge_min(data, station_id)
    n_working = working_chargers(data, station_id, time)
    n_chargers = int(data.stations.loc[data.stations["station_id"] == station_id, "n_chargers"].iloc[0])

    peak_wait = max(predict_wait(a, avg_charge_min, n_working) for a in slots["arrivals"])
    normal_peak_wait = max(predict_wait(a, avg_charge_min, n_chargers) for a in slots["arrivals_baseline"])
    busy_minutes = slots["arrivals"].sum() * avg_charge_min
    utilisation = busy_minutes / (n_chargers * LOOKAHEAD_HOURS * 60)

    # Too small even on a normal week with every charger working.
    if normal_peak_wait > RED_WAIT_MIN:
        return IssueType.chronic_undercapacity
    if peak_wait > RED_WAIT_MIN:
        return IssueType.congestion
    if utilisation < UNDERUSED_UTILISATION:
        return IssueType.underused
    return None
