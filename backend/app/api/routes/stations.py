from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_data, get_meta, parse_time, sim_time
from app.schemas import ForecastSlot, Station, StationCharger
from app.services import views
from app.services.data_loader import DataStore
from app.utils import mock_data

router = APIRouter(prefix="/stations", tags=["stations"])


@router.get("", response_model=list[Station])
def list_stations(time: datetime = Depends(sim_time), data: DataStore | None = Depends(get_data)) -> list[dict]:
    if data is None:
        return mock_data.stations()
    return views.station_list(data, time)


@router.get("/{station_id}/chargers", response_model=list[StationCharger])
def list_station_chargers(
    station_id: str, time: datetime = Depends(sim_time), data: DataStore | None = Depends(get_data)
) -> list[dict]:
    if data is None:
        return mock_data.station_chargers(station_id)
    return views.station_chargers(data, station_id, time)


@router.get("/{station_id}/forecast", response_model=list[ForecastSlot])
def get_forecast(
    station_id: str,
    start: str = Query(..., description="First slot, ISO 8601 with +08:00"),
    hours: int = Query(24, ge=1, le=72),
    meta: dict = Depends(get_meta),
    data: DataStore | None = Depends(get_data),
) -> list[dict]:
    start_time = parse_time(start, meta, "start")
    if data is None:
        return mock_data.forecast(station_id, start_time, hours)
    return views.station_forecast(data, station_id, start_time, hours)
