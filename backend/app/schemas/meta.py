from datetime import datetime

from pydantic import BaseModel


class TimeRange(BaseModel):
    start: datetime
    end: datetime


class FestivePeriod(BaseModel):
    name: str
    start: datetime
    end: datetime


class DemoTime(BaseModel):
    label: str
    time: datetime


class Assumptions(BaseModel):
    rm_per_session: float
    max_tolerable_wait_min: float
    avg_charge_min: float


class Meta(BaseModel):
    corridor_name: str
    time_range: TimeRange
    festive_periods: list[FestivePeriod]
    demo_times: list[DemoTime]
    assumptions: Assumptions


class HealthCheck(BaseModel):
    status: str
    mock: bool
    llm_configured: bool
