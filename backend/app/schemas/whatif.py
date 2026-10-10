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
    summary: str
