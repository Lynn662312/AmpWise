"""Collects issues, puts a ringgit value on each, and ranks them."""

from datetime import datetime, timedelta
from typing import Any

import pandas as pd

from app.schemas import ChargerStatus, IssueType
from app.services.classifier import classify_station, latest_health, working_chargers
from app.services.data_loader import DataStore
from app.services.explain import make_reason
from app.services.queueing import lost_sessions, predict_wait

HORIZON_HOURS = 72  # how far ahead rm_at_risk looks
HIGH_RM = 1000.0  # assumption: urgency limits
MEDIUM_RM = 200.0

RECOMMENDED_ACTIONS: dict[str, str] = {
    "safety_fault": "Take offline and inspect",
    "degraded": "Schedule maintenance",
    "connector_fault": "Replace connector",
    "congestion": "Redirect drivers",
    "chronic_undercapacity": "Add chargers",
    "underused": "Review pricing or location",
}


def floor_to_slot(time: datetime) -> datetime:
    return time.replace(minute=time.minute // 30 * 30, second=0, microsecond=0)


def upcoming_slots(data: DataStore, station_id: str, time: datetime, hours: int) -> pd.DataFrame:
    start = floor_to_slot(time)
    forecasts = data.forecasts
    return forecasts[
        (forecasts["station_id"] == station_id)
        & (forecasts["slot_start"] >= start)
        & (forecasts["slot_start"] < start + timedelta(hours=hours))
    ]


def outlook(data: DataStore, slots: pd.DataFrame, chargers: int) -> dict[str, Any]:
    """Lost sessions and the peak queue across the slots, with this many chargers working."""
    lost, first_loss, peak_wait, peak_time = 0.0, None, 0.0, None
    for slot_start, arrivals in zip(slots["slot_start"], slots["arrivals"]):
        wait = predict_wait(arrivals, data.params["avg_charge_min"], chargers)
        if peak_time is None or wait > peak_wait:
            peak_wait, peak_time = wait, slot_start.to_pydatetime()
        loss = lost_sessions(arrivals, wait, data.params["max_tolerable_wait_min"])
        if loss > 0 and first_loss is None:
            first_loss = slot_start.to_pydatetime()
        lost += loss
    return {"lost": lost, "first_loss": first_loss, "peak_wait_min": peak_wait, "peak_time": peak_time}


def recommend_action(issue_type: str) -> str:
    return RECOMMENDED_ACTIONS[issue_type]


def score_issue(issue: dict[str, Any]) -> tuple[int, float]:
    """Sort key: safety faults first, then the most ringgit at risk."""
    return (0 if issue["issue_type"] == "safety_fault" else 1, -issue["rm_at_risk"])


def _urgency(issue: dict[str, Any]) -> str:
    if issue["issue_type"] == "safety_fault":
        return "critical"
    if issue["rm_at_risk"] >= HIGH_RM:
        return "high"
    return "medium" if issue["rm_at_risk"] >= MEDIUM_RM else "low"


def _station_issues(data: DataStore, station: Any, time: datetime) -> list[dict[str, Any]]:
    rm_per_session = data.params["rm_per_session"]
    slots = upcoming_slots(data, station.station_id, time, HORIZON_HOURS)
    n_working = working_chargers(data, station.station_id, time)
    current = outlook(data, slots, n_working)
    issues: list[dict[str, Any]] = []

    # Faulty chargers: value = sessions saved by getting this one charger back.
    charger_ids = data.health.loc[data.health["station_id"] == station.station_id, "charger_id"].unique()
    for charger_id in charger_ids:
        health = latest_health(data, charger_id, time)
        if health is None or health["status"] == ChargerStatus.healthy.value:
            continue
        saved = current["lost"] - outlook(data, slots, n_working + 1)["lost"]
        is_safety = health["status"] == ChargerStatus.safety_fault.value
        issues.append({
            **current,
            "issue_type": health["status"],
            "charger_id": charger_id,
            "rm_at_risk": float(health["p_fault"]) * saved * rm_per_session,
            "deadline": time if is_safety else current["first_loss"],
            "power_ratio": float(health["power_ratio"]),
            "evidence": health["evidence"],
        })

    # Station problems: value = sessions still lost with every charger working.
    station_issue = classify_station(data, station.station_id, time)
    if station_issue is not None:
        full = outlook(data, slots, int(station.n_chargers))
        rm = 0.0 if station_issue == IssueType.underused else full["lost"] * rm_per_session
        # Congestion that disappears once the faulty chargers are fixed is already covered above.
        if not (station_issue == IssueType.congestion and rm == 0):
            issues.append({
                **full,
                "issue_type": station_issue.value,
                "charger_id": None,
                "rm_at_risk": rm,
                "deadline": full["first_loss"],
            })

    for issue in issues:
        issue["station_id"] = station.station_id
        issue["station_name"] = station.name
    return issues


def build_action_list(data: DataStore, time: datetime, limit: int | None = None) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    for station in data.stations.itertuples():
        issues.extend(_station_issues(data, station, time))
    issues.sort(key=score_issue)

    actions = []
    for rank, issue in enumerate(issues[:limit], start=1):
        actions.append({
            "id": f"{issue['issue_type']}:{issue['station_id']}:{issue['charger_id'] or '-'}",
            "rank": rank,
            "issue_type": issue["issue_type"],
            "station_id": issue["station_id"],
            "station_name": issue["station_name"],
            "charger_id": issue["charger_id"],
            "recommended_action": recommend_action(issue["issue_type"]),
            "rm_at_risk": round(issue["rm_at_risk"], 2),
            "deadline": issue["deadline"],
            "urgency": _urgency(issue),
            "reason": make_reason(issue),
            "state": "open",
        })
    return actions
