from enum import Enum


class IssueType(str, Enum):
    safety_fault = "safety_fault"
    degraded = "degraded"
    connector_fault = "connector_fault"
    congestion = "congestion"
    chronic_undercapacity = "chronic_undercapacity"
    underused = "underused"


class ChargerStatus(str, Enum):
    healthy = "healthy"
    degraded = "degraded"
    connector_fault = "connector_fault"
    safety_fault = "safety_fault"


class Urgency(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class WaitLevel(str, Enum):
    """green < 15 min, amber 15-40, red > 40."""

    green = "green"
    amber = "amber"
    red = "red"


class ActionState(str, Enum):
    open = "open"
    assigned = "assigned"
    done = "done"
