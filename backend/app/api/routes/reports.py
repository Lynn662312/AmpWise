from fastapi import APIRouter, Depends

from app.api.deps import get_data
from app.schemas import ReportCategory
from app.services.data_loader import DataStore
from app.utils import mock_data

router = APIRouter(prefix="/reports", tags=["reports"])


# Counted over all of ML's feedback, so there is no `time` parameter.
@router.get("/categories", response_model=list[ReportCategory])
def get_report_categories(data: DataStore | None = Depends(get_data)) -> list[dict]:
    return mock_data.report_categories() if data is None else data.report_categories
