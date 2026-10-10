"""Collects issues, puts a ringgit value on each, and ranks them."""

from datetime import datetime, timedelta
from typing import Any

import pandas as pd

from app.schemas import ChargerStatus, IssueType
from app.services.classifier import charge_min, classify_station, latest_health, recent_reports, working_chargers
from app.services.data_loader import DataStore
from app.services.explain import make_reason
from app.services.queueing import lost_sessions, predict_wait

HORIZON_HOURS = 72  # how far ahead rm_at_risk looks
HIGH_RM = 1000.0  # assumption: urgency limits
MEDIUM_RM = 200.0
MIN_REPORTS = 2  # assumption: one driver report alone is not enough to send a technician

RECOMMENDED_ACTIONS: dict[str, str] = {
    "safety_fault": "Take offline and inspect",
    "degraded": "Schedule maintenance",
    "connector_fault": "Replace connector",
    "user_reported": "Inspect charger",
    "congestion": "Redirect drivers",
    "chronic_undercapacity": "Add chargers",
    "underused": "Review pricing or location",
    "site_issue": "Needs human action",
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
    avg_charge_min = charge_min(data, slots["station_id"].iloc[0]) if len(slots) else 0.0
    for slot_start, arrivals in zip(slots["slot_start"], slots["arrivals"]):
        wait = predict_wait(arrivals, avg_charge_min, chargers)
        if peak_time is None or wait > peak_wait:
            peak_wait, peak_time = wait, slot_start.to_pydatetime()
        loss = lost_sessions(arrivals, wait, data.params["max_tolerable_wait_min"])
        if loss > 0 and first_loss is None:
            first_loss = slot_start.to_pydatetime()
        lost += loss
    return {"lost": lost, "first_loss": first_loss, "peak_wait_min": peak_wait, "peak_time": peak_time}


def recommend_action(issue_type: str) -> str:
    return RECOMMENDED_ACTIONS[issue_type]


def score_issue(issue: dict[str, Any]) -> tuple[int, int, float]:
    """Sort key, lowest first.

    1. Safety faults.
    2. Charger maintenance (found by sensors or reported by drivers): most driver reports first,
       because reports show how many people the fault is affecting. Ties: most money at risk first.
    3. Station problems (congestion, capacity, underuse): most money at risk first.
    4. Site issues (blocked or dirty bay, which a technician cannot fix): most driver reports first.
    """
    if issue["issue_type"] == "safety_fault":
        return (0, 0, 0.0)
    if issue["issue_type"] == "site_issue":
        return (3, -issue["report_count"], 0.0)
    if issue["charger_id"]:
        return (1, -issue["report_count"], -issue["rm_at_risk"])
    return (2, 0, -issue["rm_at_risk"])


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
    for charger_id in data.chargers_by_station.get(station.station_id, []):
        health = latest_health(data, charger_id, time)
        reports = recent_reports(data, charger_id, time)
        sensor_fault = health is not None and health["status"] != ChargerStatus.healthy.value

        if sensor_fault:
            saved = current["lost"] - outlook(data, slots, n_working + 1)["lost"]
            is_safety = health["status"] == ChargerStatus.safety_fault.value
            issues.append({
                **current,
                "issue_type": health["status"],
                "charger_id": charger_id,
                "rm_at_risk": float(health["p_fault"]) * saved * rm_per_session,
                "deadline": time if is_safety else current["first_loss"],
                "evidence": health["evidence"],
                "report_count": len(reports),
                "first_report": reports.iloc[0].to_pydatetime() if len(reports) else None,
            })
        elif len(reports) >= MIN_REPORTS:
            # The sensors see nothing, but drivers keep reporting it.
            # Value = sessions lost if the reports are right and the charger is really down.
            if_down = outlook(data, slots, n_working - 1)
            issues.append({
                **if_down,
                "issue_type": IssueType.user_reported.value,
                "charger_id": charger_id,
                "rm_at_risk": (if_down["lost"] - current["lost"]) * rm_per_session,
                "deadline": if_down["first_loss"],
                "report_count": len(reports),
                "first_report": reports.iloc[0].to_pydatetime(),
            })

        # Drivers keep reporting the bay (blocked or dirty). No money value: the charger itself works.
        site_reports = recent_reports(data, charger_id, time, about_site=True)
        if len(site_reports) >= MIN_REPORTS:
            issues.append({
                **current,
                "issue_type": IssueType.site_issue.value,
                "charger_id": charger_id,
                "rm_at_risk": 0.0,
                "deadline": None,
                "report_count": len(site_reports),
                "first_report": site_reports.iloc[0].to_pydatetime(),
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
                "report_count": 0,
                "first_report": None,
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
            "report_count": issue["report_count"],
            "first_reported_at": issue["first_report"],
            "state": "open",
        })
    return actions
