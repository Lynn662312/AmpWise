from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.api.deps import parse_time, require_mock, sim_time
from app.schemas import Action, Advice, AdviceRequest
from app.utils import mock_data

router = APIRouter(prefix="/actions", tags=["actions"], dependencies=[Depends(require_mock)])


@router.get("", response_model=list[Action])
def list_actions(time: datetime = Depends(sim_time), limit: int = Query(20, ge=1)) -> list[dict]:
    return mock_data.actions(limit)


# Action ids contain ":" and "-", so match the whole path segment.
@router.post("/{action_id:path}/advice", response_model=Advice)
def get_advice(action_id: str, body: AdviceRequest) -> dict:
    parse_time(body.time)
    return mock_data.advice(action_id)
