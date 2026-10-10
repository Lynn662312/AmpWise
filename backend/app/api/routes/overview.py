from fastapi import APIRouter

from app.schemas import OverviewResponse
from app.utils import placeholder_data

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("", response_model=OverviewResponse)
def get_overview() -> dict:
    """BACKEND PLACEHOLDER — replace with approved session and uptime services."""
    return placeholder_data.overview()
