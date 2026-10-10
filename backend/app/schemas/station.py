from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import WaitLevel


class Station(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    n_chargers: int
    n_working: int
    power_kw: float
    predicted_wait_min: float
    level: WaitLevel
    open_issue_count: int


class ForecastSlot(BaseModel):
    slot_start: datetime
    arrivals: float
    arrivals_baseline: float
    wait_min: float
    is_festive: bool
