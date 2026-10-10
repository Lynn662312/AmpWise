"""Collects issues, puts a money value on each, and ranks them."""

import math
from datetime import datetime, timedelta
from typing import Any

import pandas as pd

from app.schemas import ChargerStatus, IssueType
from app.services.classifier import (
    charge_min,
    classify_station,
    latest_health,
    recent_reports,
    working_chargers,
)
from app.services.data_loader import DataStore
from app.services.explain import make_reason
from app.services.queueing import SLOT_MIN, predict_wait, served_by_occupancy

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


def earlier_arrivals(data: DataStore, station_id: str, start: datetime) -> list[float]:
    """Forecast arrivals in the slots just before `start`, far enough back to cover one charge:
    those cars may still be on a charger."""
    n_slots = math.ceil(charge_min(data, station_id) / SLOT_MIN) + 1
    forecasts = data.forecasts
    before = forecasts[
        (forecasts["station_id"] == station_id)
        & (forecasts["slot_start"] < start)
        & (forecasts["slot_start"] >= start - timedelta(minutes=SLOT_MIN * n_slots))
    ]
    return list(before["arrivals"])


def outlook(data: DataStore, slots: pd.DataFrame, chargers: int) -> dict[str, Any]:
    """Sessions served and not served, and the peak queue, across the slots with this many chargers working.

    Served and unserved follow the chargers' occupancy (a car needs a free charger), not the wait.
    """
    served = unserved = peak_wait = queue_minutes = arrivals_total = 0.0
    first_unserved = peak_time = None
    if slots.empty:
        served_each: list[float] = []
        avg_charge_min = 0.0
    else:
        station_id, start = slots["station_id"].iloc[0], slots["slot_start"].iloc[0]
        avg_charge_min = charge_min(data, station_id)
        earlier = earlier_arrivals(data, station_id, start)
        served_each = served_by_occupancy(list(slots["arrivals"]), avg_charge_min, chargers, earlier)
    for slot_start, arrivals, served_now in zip(slots["slot_start"], slots["arrivals"], served_each):
        wait = predict_wait(arrivals, avg_charge_min, chargers)
        if peak_time is None or wait > peak_wait:
            peak_wait, peak_time = wait, slot_start.to_pydatetime()
        missed = max(0.0, arrivals - served_now)
        if missed > 1e-9 and first_unserved is None:
            first_unserved = slot_start.to_pydatetime()
        unserved += missed
        served += served_now
        queue_minutes += arrivals * wait
        arrivals_total += arrivals
    return {
        "served": served,
        "unserved": unserved,
        "first_unserved": first_unserved,
        "peak_wait_min": peak_wait,
        # The wait an arriving car can expect on average: it moves even when the peak stays at the cap.
        "avg_wait_min": round(queue_minutes / arrivals_total, 1) if arrivals_total else 0.0,
        "peak_time": peak_time,
    }


def recommend_action(issue_type: str) -> str:
    return RECOMMENDED_ACTIONS[issue_type]


def score_issue(issue: dict[str, Any]) -> tuple[int, float, int]:
    """Sort key, lowest first. Money at risk is the main business priority.

    1. Safety faults.
    2. Every other charger and station issue that can cost revenue, in one list: most money at risk
       first. Ties: most driver reports first.
    3. Underused stations, which never have money at risk.
    """
    if issue["issue_type"] == "safety_fault":
        return (0, 0.0, 0)
    if issue["issue_type"] == "underused":
        return (2, 0.0, 0)
    return (1, -round(issue["rm_at_risk"], 2), -issue["report_count"])


def _urgency(issue: dict[str, Any]) -> str:
    if issue["issue_type"] == "safety_fault":
        return "critical"
    if issue["rm_at_risk"] >= HIGH_RM:
        return "high"
    return "medium" if issue["rm_at_risk"] >= MEDIUM_RM else "low"


def _station_issues(data: DataStore, station: Any, time: datetime) -> list[dict[str, Any]]:
    slots = upcoming_slots(data, station.station_id, time, HORIZON_HOURS)
    n_working = working_chargers(data, station.station_id, time)
    current = outlook(data, slots, n_working)
    issues: list[dict[str, Any]] = []

    for charger_id in data.chargers_by_station.get(station.station_id, []):
        health = latest_health(data, charger_id, time)
        reports = recent_reports(data, charger_id, time)
        sensor_fault = health is not None and health["status"] != ChargerStatus.healthy.value

        if sensor_fault:
            # Sessions at risk = the sessions one more working charger would serve.
            # A charger marked done already counts in n_working, so its action is valued without it.
            down = outlook(data, slots, n_working - 1) if charger_id in data.repaired else current
            fixed = current if charger_id in data.repaired else outlook(data, slots, n_working + 1)
            is_safety = health["status"] == ChargerStatus.safety_fault.value
            issues.append({
                **down,
                "issue_type": health["status"],
                "charger_id": charger_id,
                "sessions_at_risk": float(health["p_fault"]) * (down["unserved"] - fixed["unserved"]),
                "deadline": time if is_safety else down["first_unserved"],
                "evidence": health["evidence"],
                "report_count": len(reports),
                "first_report": reports.iloc[0].to_pydatetime() if len(reports) else None,
            })
        elif len(reports) >= MIN_REPORTS:
            # The sensors see nothing, but drivers keep reporting it.
            # Sessions at risk = the sessions not served if the reports are right and it is really down.
            if_down = outlook(data, slots, n_working - 1)
            issues.append({
                **if_down,
                "issue_type": IssueType.user_reported.value,
                "charger_id": charger_id,
                "sessions_at_risk": if_down["unserved"] - current["unserved"],
                "deadline": if_down["first_unserved"],
                "report_count": len(reports),
                "first_report": reports.iloc[0].to_pydatetime(),
            })

    # Station problems: sessions at risk = the sessions not served even with every charger working.
    station_issue = classify_station(data, station.station_id, time)
    if station_issue is not None:
        full = outlook(data, slots, int(station.n_chargers))
        # A queue with every car still served costs no session, so it is shown on the map but not listed.
        # This also covers congestion that disappears once the faulty chargers are fixed.
        nothing_at_risk = station_issue != IssueType.underused and full["unserved"] <= 1e-9
        if not nothing_at_risk:
            issues.append({
                **full,
                "issue_type": station_issue.value,
                "charger_id": None,
                "sessions_at_risk": 0.0 if station_issue == IssueType.underused else full["unserved"],
                "deadline": full["first_unserved"],
                "report_count": 0,
                "first_report": None,
            })

    for issue in issues:
        issue["rm_at_risk"] = issue["sessions_at_risk"] * data.params["rm_per_session"]
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
