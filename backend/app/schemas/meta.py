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


class BacktestWeek(BaseModel):
    value: str
    label: str


class Assumptions(BaseModel):
    rm_per_session: float
    avg_charge_min: float


class Meta(BaseModel):
    corridor_name: str
    currency: str
    time_range: TimeRange
    festive_periods: list[FestivePeriod]
    demo_times: list[DemoTime]
    backtest_weeks: list[BacktestWeek]
    assumptions: Assumptions


class HealthCheck(BaseModel):
    status: str
    mock: bool
    llm_configured: bool
