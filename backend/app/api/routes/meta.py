from fastapi import APIRouter, Depends

from app.api.deps import get_meta
from app.core.config import Settings, get_settings
from app.schemas import HealthCheck, Meta

router = APIRouter(tags=["meta"])


@router.get("/meta", response_model=Meta)
def read_meta(meta: dict = Depends(get_meta)) -> dict:
    return meta


@router.get("/health", response_model=HealthCheck)
def get_health(settings: Settings = Depends(get_settings)) -> dict:
    return {"status": "ok", "mock": settings.mock, "llm_configured": settings.llm_configured}
