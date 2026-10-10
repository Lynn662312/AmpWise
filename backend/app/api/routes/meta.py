from fastapi import APIRouter, Depends

from app.api.deps import require_mock
from app.core.config import Settings, get_settings
from app.schemas import HealthCheck, Meta
from app.utils import mock_data

router = APIRouter(tags=["meta"])


@router.get("/meta", response_model=Meta, dependencies=[Depends(require_mock)])
def get_meta() -> dict:
    return mock_data.meta()


@router.get("/health", response_model=HealthCheck)
def get_health(settings: Settings = Depends(get_settings)) -> dict:
    return {"status": "ok", "mock": settings.mock, "llm_configured": settings.llm_configured}
