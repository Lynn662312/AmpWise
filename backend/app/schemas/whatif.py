from typing import Literal

from pydantic import BaseModel, Field


class WhatIfRequest(BaseModel):
    scenario: Literal["fix_now", "add_chargers", "discount"]
    time: str
    station_id: str
    charger_id: str | None = None
    n_chargers: int | None = Field(default=None, ge=1)
    discount_pct: float | None = Field(default=None, ge=0, le=50)


class WhatIfResult(BaseModel):
    before_wait_min: float
    after_wait_min: float
    before_revenue_rm: float
    after_revenue_rm: float
    before_at_risk_rm: float
    after_at_risk_rm: float
    summary: str


class ScenarioCreate(BaseModel):
    """One what-if run to save."""

    name: str = Field(min_length=1, max_length=80)
    request: WhatIfRequest
    result: WhatIfResult


class Scenario(ScenarioCreate):
    id: str
