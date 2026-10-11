from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_data, sim_time
from app.schemas import ChargerEvent, ChargerHealth
from app.services import views
from app.services.data_loader import DataStore
from app.utils import mock_data

router = APIRouter(prefix="/chargers", tags=["chargers"])


@router.get("/{charger_id}/health", response_model=ChargerHealth)
def get_charger_health(
    charger_id: str,
    time: datetime = Depends(sim_time),
    days: int = Query(14, ge=1),
    data: DataStore | None = Depends(get_data),
) -> dict:
    if data is None:
        return mock_data.charger_health(charger_id)
    return views.charger_health(data, charger_id, time, days)


@router.get("/{charger_id}/events", response_model=list[ChargerEvent])
def get_charger_events(
    charger_id: str,
    time: datetime = Depends(sim_time),
    days: int = Query(14, ge=1),
    data: DataStore | None = Depends(get_data),
) -> list[dict]:
    if data is None:
        return mock_data.charger_events(charger_id)
    return views.charger_events(data, charger_id, time, days)
