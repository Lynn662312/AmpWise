from fastapi import APIRouter, Depends

from app.api.deps import get_data, get_meta, parse_time
from app.schemas import WhatIfRequest, WhatIfResult
from app.services import whatif
from app.services.data_loader import DataStore
from app.utils import mock_data

router = APIRouter(prefix="/whatif", tags=["whatif"])


@router.post("", response_model=WhatIfResult)
def run_whatif(
    body: WhatIfRequest, meta: dict = Depends(get_meta), data: DataStore | None = Depends(get_data)
) -> dict:
    time = parse_time(body.time, meta)
    if data is None:
        return mock_data.whatif(body.station_id)
    return whatif.run_whatif(data, body, time)
