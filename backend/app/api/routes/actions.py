from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_data, get_meta, parse_time, require_mock, sim_time
from app.schemas import Action, Advice, AdviceRequest
from app.services.data_loader import DataStore
from app.services.priority import build_action_list
from app.utils import mock_data

router = APIRouter(prefix="/actions", tags=["actions"])


@router.get("", response_model=list[Action])
def list_actions(
    time: datetime = Depends(sim_time),
    limit: int = Query(20, ge=1),
    data: DataStore | None = Depends(get_data),
) -> list[dict]:
    if data is None:
        return mock_data.actions(limit)
    return build_action_list(data, time, limit)


# Action ids contain ":" and "-", so match the whole path segment.
@router.post("/{action_id:path}/advice", response_model=Advice, dependencies=[Depends(require_mock)])
def get_advice(action_id: str, body: AdviceRequest, meta: dict = Depends(get_meta)) -> dict:
    parse_time(body.time, meta)
    return mock_data.advice(action_id)
