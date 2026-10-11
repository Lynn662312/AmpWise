from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import get_firestore
from app.core.config import Settings, get_settings
from app.core.errors import ApiError, bad_request
from app.firebase import client as firebase_store
from app.schemas.whatif import Scenario, ScenarioCreate

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


def _require(firestore: Any | None) -> Any:
    if firestore is None:
        raise ApiError(500, "Firestore is not configured")
    return firestore


@router.get("", response_model=list[Scenario])
def list_scenarios(
    settings: Settings = Depends(get_settings), firestore: Any | None = Depends(get_firestore)
) -> list[dict[str, Any]]:
    """Saved what-if runs, newest first."""
    if firestore is None and settings.mock:
        return []
    return firebase_store.list_scenarios(_require(firestore))


@router.post("", response_model=Scenario, status_code=201)
def save_scenario(
    body: ScenarioCreate, settings: Settings = Depends(get_settings), firestore: Any | None = Depends(get_firestore)
) -> dict[str, Any]:
    if firestore is None and settings.mock:  # mock mode stores nothing
        return {"id": "mock", **body.model_dump(mode="json")}
    client = _require(firestore)
    if len(firebase_store.list_scenarios(client)) >= firebase_store.MAX_SCENARIOS:
        raise bad_request(f"Only {firebase_store.MAX_SCENARIOS} runs can be saved. Reset the demo to clear them.")
    scenario = body.model_dump(mode="json")
    return {"id": firebase_store.add_scenario(client, scenario), **scenario}
