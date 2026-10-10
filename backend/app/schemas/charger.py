from datetime import date

from pydantic import BaseModel

from app.schemas.common import ChargerStatus


class PowerRatioPoint(BaseModel):
    date: date
    ratio: float
    baseline: float


class ChargerHealth(BaseModel):
    charger_id: str
    station_id: str
    status: ChargerStatus
    p_fault: float
    evidence: list[str]
    series: list[PowerRatioPoint]
    degraded_since: date | None
