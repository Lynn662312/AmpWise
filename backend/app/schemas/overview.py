from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class OverviewTrendPoint(BaseModel):
    date: date
    kwh: float = Field(ge=0)


class OverviewResponse(BaseModel):
    data_source: Literal["api", "placeholder"]  # "placeholder" only in mock mode
    energy_delivered_kwh: float = Field(ge=0)
    energy_delivered_week_kwh: float = Field(ge=0)
    live_sessions: int = Field(ge=0)
    network_uptime_pct: float = Field(ge=0, le=100)
    energy_trend: list[OverviewTrendPoint]
