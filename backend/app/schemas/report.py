from pydantic import BaseModel


class ReportCategory(BaseModel):
    category: str
    count: int
    percentage: float
