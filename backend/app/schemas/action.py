from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import ActionState, IssueType, Urgency


class Action(BaseModel):
    id: str
    rank: int
    issue_type: IssueType
    station_id: str
    station_name: str
    charger_id: str | None
    recommended_action: str
    rm_at_risk: float
    deadline: datetime | None
    urgency: Urgency
    reason: str
    state: ActionState


class AdviceRequest(BaseModel):
    time: str
    language: Literal["en", "zh", "ms"] = "en"


class Advice(BaseModel):
    action_id: str
    summary: str
    steps: list[str]
    caveats: list[str]
    source: Literal["llm", "template"]
    cached: bool
