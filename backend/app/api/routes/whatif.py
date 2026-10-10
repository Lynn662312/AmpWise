from fastapi import APIRouter, Depends

from app.api.deps import parse_time, require_mock
from app.schemas import WhatIfRequest, WhatIfResult
from app.utils import mock_data

router = APIRouter(prefix="/whatif", tags=["whatif"], dependencies=[Depends(require_mock)])


@router.post("", response_model=WhatIfResult)
def run_whatif(body: WhatIfRequest) -> dict:
    parse_time(body.time)
    return mock_data.whatif(body.station_id)
