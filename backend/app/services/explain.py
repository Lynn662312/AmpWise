"""One templated sentence per action. No AI here."""

from datetime import datetime
from typing import Any

from app.services.queueing import MAX_WAIT_MIN

MIN_SESSIONS_AT_RISK = 0.1  # assumption: under a tenth of a session in 3 days counts as nothing at risk


def _when(moment: datetime) -> str:
    """Thursday 6pm"""
    hour = moment.hour % 12 or 12
    minutes = f":{moment.minute:02d}" if moment.minute else ""
    return f"{moment:%A} {hour}{minutes}{'am' if moment.hour < 12 else 'pm'}"


def _queue(wait_min: float) -> str:
    if wait_min >= MAX_WAIT_MIN:
        return "a queue of 2 hours or more"
    return f"a {wait_min:.0f}-minute queue"


def _at_risk(issue: dict[str, Any], lead: str = "An") -> str:
    """The sessions the station is forecast to be unable to serve: an estimate, not customers seen leaving."""
    sessions = issue["sessions_at_risk"]
    if sessions < MIN_SESSIONS_AT_RISK:
        return ""
    return f" {lead} estimated {sessions:.1f} sessions are at risk over the next 3 days."


def make_reason(issue: dict[str, Any]) -> str:
    station = issue["station_name"]
    issue_type = issue["issue_type"]
    if issue["peak_wait_min"] >= 1:
        peak = f"the forecast peak is {_queue(issue['peak_wait_min'])} on {issue['peak_time']:%A}"
    else:
        peak = "no queue is forecast for the next 3 days"

    if issue["charger_id"] is None:
        if issue_type == "congestion":
            return (
                f"{station} is short of chargers for the coming peak: even with every charger working, {peak}."
                f"{_at_risk(issue)}"
            )
        if issue_type == "chronic_undercapacity":
            return f"{station} queues above 40 minutes on normal demand, so it needs more chargers.{_at_risk(issue)}"
        return f"{station} is under 10% busy over the next 24 hours."

    charger = f"Charger {issue['charger_id'].rsplit('_c', 1)[-1]} at {station}"
    by = f" by {_when(issue['deadline'])}" if issue["deadline"] else ""
    reports = issue["report_count"]
    if issue_type == "user_reported":
        return (
            f"Inspect {charger}{by}. {reports} drivers have reported it since {_when(issue['first_report'])}, "
            f"but its sensors show no fault.{_at_risk(issue, lead='If it is really down, an')}"
        )

    # Faults the sensors detected; driver reports are added as supporting evidence.
    backed = f" Drivers have also reported it ({reports} report{'s' if reports > 1 else ''})." if reports else ""
    if issue_type == "safety_fault":
        return f"Take {charger} offline now. {issue['evidence'][0]}.{_at_risk(issue)}{backed}"
    if issue_type == "connector_fault":
        return f"Repair the connector on {charger}{by}. {issue['evidence'][0]}, and {peak}.{_at_risk(issue)}{backed}"
    return f"Fix {charger}{by}. {issue['evidence'][0]}, and {peak}.{_at_risk(issue)}{backed}"
