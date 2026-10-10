from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.api.deps import parse_time, require_mock, sim_time
from app.schemas import ForecastSlot, Station
from app.utils import mock_data

router = APIRouter(prefix="/stations", tags=["stations"], dependencies=[Depends(require_mock)])


@router.get("", response_model=list[Station])
def list_stations(time: datetime = Depends(sim_time)) -> list[dict]:
    return mock_data.stations()


@router.get("/{station_id}/forecast", response_model=list[ForecastSlot])
def get_forecast(
    station_id: str,
    start: str = Query(..., description="First slot, ISO 8601 with +08:00"),
    hours: int = Query(24, ge=1, le=72),
) -> list[dict]:
    return mock_data.forecast(station_id, parse_time(start, "start"), hours)
