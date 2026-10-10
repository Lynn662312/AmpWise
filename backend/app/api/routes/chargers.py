from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_mock, sim_time
from app.schemas import ChargerHealth
from app.utils import mock_data

router = APIRouter(prefix="/chargers", tags=["chargers"], dependencies=[Depends(require_mock)])


@router.get("/{charger_id}/health", response_model=ChargerHealth)
def get_charger_health(
    charger_id: str,
    time: datetime = Depends(sim_time),
    days: int = Query(14, ge=1),
) -> dict:
    return mock_data.charger_health(charger_id)
