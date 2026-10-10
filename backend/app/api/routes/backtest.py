from fastapi import APIRouter, Depends, Query

from app.api.deps import require_mock
from app.schemas import BacktestResult
from app.utils import mock_data

router = APIRouter(prefix="/backtest", tags=["backtest"], dependencies=[Depends(require_mock)])


@router.get("", response_model=BacktestResult)
def get_backtest(week: str = Query("raya_2026")) -> dict:
    return mock_data.backtest()
