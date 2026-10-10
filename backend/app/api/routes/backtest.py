from fastapi import APIRouter, Depends, Query

from app.api.deps import get_data
from app.schemas import BacktestResult
from app.services import backtest
from app.services.data_loader import DataStore
from app.utils import mock_data

router = APIRouter(prefix="/backtest", tags=["backtest"])


# Only one week is available (the first festive period in the data), so `week` is accepted but not used yet.
@router.get("", response_model=BacktestResult)
def get_backtest(week: str = Query("raya_2026"), data: DataStore | None = Depends(get_data)) -> dict:
    if data is None:
        return mock_data.backtest()
    return backtest.run_backtest(data)
