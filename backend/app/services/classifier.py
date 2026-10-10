"""Turns forecasts and health results into issue types (docs/api_contract.md section 2)."""

from datetime import datetime, timedelta

from app.schemas import ChargerStatus, IssueType
from app.services.data_loader import DataStore
from app.services.queueing import predict_wait

LOOKAHEAD_HOURS = 24
RED_WAIT_MIN = 40.0  # same limit as WaitLevel "red"
UNDERUSED_UTILISATION = 0.10  # assumption: under 10% busy over the next day


def classify_charger(data: DataStore, charger_id: str, time: datetime) -> ChargerStatus:
    """Latest health status on or before the simulated day."""
    rows = data.health[(data.health["charger_id"] == charger_id) & (data.health["date"] <= time.date())]
    if rows.empty:
        return ChargerStatus.healthy
    return ChargerStatus(rows.iloc[-1]["status"])


def working_chargers(data: DataStore, station_id: str, time: datetime) -> int:
    """Chargers at the station that are not flagged faulty."""
    charger_ids = data.health.loc[data.health["station_id"] == station_id, "charger_id"].unique()
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

    avg_charge_min = data.params["avg_charge_min"]
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
