from datetime import datetime

from fastapi import APIRouter, Depends

from app.api.deps import get_data, sim_time
from app.schemas import OverviewResponse
from app.services import views
from app.services.data_loader import DataStore
from app.utils import placeholder_data

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("", response_model=OverviewResponse)
def get_overview(time: datetime = Depends(sim_time), data: DataStore | None = Depends(get_data)) -> dict:
    """Energy delivered, live sessions and uptime at the simulated time. Mock mode returns fixed sample numbers."""
    if data is None:
        return placeholder_data.overview()
    return views.build_overview(data, time)
