from datetime import date

from pydantic import BaseModel


class BacktestDay(BaseModel):
    date: date
    wait_baseline_min: float
    wait_ours_min: float


class BacktestResult(BaseModel):
    week_label: str
    queue_minutes_saved: float
    rm_protected: float
    forecast_mae_ours: float
    forecast_mae_baseline: float
    fault_precision: float
    fault_recall: float
    daily: list[BacktestDay]
