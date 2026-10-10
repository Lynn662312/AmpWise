"""One templated sentence per action. No AI here."""

from datetime import datetime
from typing import Any

from app.services.queueing import MAX_WAIT_MIN


def _when(moment: datetime) -> str:
    """Thursday 6pm"""
    hour = moment.hour % 12 or 12
    minutes = f":{moment.minute:02d}" if moment.minute else ""
    return f"{moment:%A} {hour}{minutes}{'am' if moment.hour < 12 else 'pm'}"


def _queue(wait_min: float) -> str:
    if wait_min >= MAX_WAIT_MIN:
        return "a queue of 2 hours or more"
    return f"a {wait_min:.0f}-minute queue"


def make_reason(issue: dict[str, Any]) -> str:
    station = issue["station_name"]
    issue_type = issue["issue_type"]
    peak = f"the forecast peak is {_queue(issue['peak_wait_min'])} on {issue['peak_time']:%A}"

    if issue["charger_id"] is None:
        if issue_type == "congestion":
            return f"{station} is short of chargers for the coming peak: even with every charger working, {peak}."
        if issue_type == "chronic_undercapacity":
            return f"{station} queues above 40 minutes on normal demand, so it needs more chargers."
        return f"{station} is under 10% busy over the next 24 hours."

    charger = f"Charger {issue['charger_id'].rsplit('_c', 1)[-1]} at {station}"
    by = f" by {_when(issue['deadline'])}" if issue["deadline"] else ""
    if issue_type == "safety_fault":
        return f"Take {charger} offline now. {issue['evidence'][0]}."
    if issue_type == "connector_fault":
        return f"Repair the connector on {charger}{by}. {issue['evidence'][0]}, and {peak}."
    return (
        f"Fix {charger}{by}. It is delivering {issue['power_ratio'] * 100:.0f}% of rated power, and {peak}."
    )
