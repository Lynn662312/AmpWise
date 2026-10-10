from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import get_data, get_firestore
from app.api.routes.actions import forget_states
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.firebase import client as firebase_store
from app.schemas.action import DemoResetRequest, DemoResetResult
from app.services.data_loader import DataStore

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/reset", response_model=DemoResetResult)
def reset_demo(
    body: DemoResetRequest | None = None,
    settings: Settings = Depends(get_settings),
    data: DataStore | None = Depends(get_data),
    firestore: Any | None = Depends(get_firestore),
) -> dict[str, int]:
    """Every action is open again (and the saved what-if runs go, when asked), so a demo starts clean."""
    if firestore is None and not settings.mock:
        raise ApiError(500, "Firestore is not configured")
    cleared = {"cleared_actions": 0, "cleared_scenarios": 0}
    if firestore is not None:
        cleared["cleared_actions"] = firebase_store.clear_action_states(firestore)
        if body is not None and body.clear_scenarios:
            cleared["cleared_scenarios"] = firebase_store.clear_scenarios(firestore)
    forget_states()
    if data is not None:
        data.repaired.clear()
    return cleared
