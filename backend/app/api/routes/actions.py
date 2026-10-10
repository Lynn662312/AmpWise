from datetime import datetime

from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_data, get_firestore, get_meta, parse_time, sim_time
from app.core.config import Settings, get_settings
from app.core.errors import ApiError, not_found
from app.firebase import client as firebase_store
from app.schemas import Action, Advice, AdviceRequest
from app.schemas.action import ActionStatusRequest
from app.services import llm
from app.services.data_loader import DataStore
from app.services.priority import build_action_list
from app.utils import mock_data

router = APIRouter(prefix="/actions", tags=["actions"])
_recent_actions: dict[str, dict[str, Any]] = {}


@router.get("", response_model=list[Action])
def list_actions(
    time: datetime = Depends(sim_time),
    limit: int = Query(20, ge=1),
    data: DataStore | None = Depends(get_data),
    firestore: Any | None = Depends(get_firestore),
) -> list[dict]:
    source_actions = mock_data.actions(limit) if data is None else build_action_list(data, time, limit)
    actions = [dict(action) for action in source_actions]
    if firestore is not None:
        states = firebase_store.read_action_states(firestore, [action["id"] for action in actions])
        for action in actions:
            action["state"] = states.get(action["id"], "open")

    for action in actions:
        _recent_actions[action["id"]] = dict(action)
    return actions


@router.patch("/{action_id:path}/status", response_model=Action)
def update_action_status(
    action_id: str,
    body: ActionStatusRequest,
    settings: Settings = Depends(get_settings),
    firestore: Any | None = Depends(get_firestore),
) -> dict[str, Any]:
    action = _recent_actions.get(action_id)
    if action is None and settings.mock:
        action = next((item for item in mock_data.actions(100) if item["id"] == action_id), None)
    if action is None:
        raise not_found(f"Action {action_id} does not exist")
    if firestore is None and not settings.mock:
        raise ApiError(500, "Firestore is not configured")
    if firestore is not None:
        firebase_store.write_action_state(firestore, action_id, body.state)
    updated = {**action, "state": body.state}
    _recent_actions[action_id] = updated
    return updated


# Action ids contain ":" and "-", so match the whole path segment.
@router.post("/{action_id:path}/advice", response_model=Advice)
def get_advice(
    action_id: str,
    body: AdviceRequest,
    meta: dict = Depends(get_meta),
    data: DataStore | None = Depends(get_data),
    settings: Settings = Depends(get_settings),
) -> dict:
    time = parse_time(body.time, meta)
    if data is None:
        return mock_data.advice(action_id)
    return llm.get_advice(data, settings, action_id, time, body.language)
