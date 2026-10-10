import re
from datetime import datetime

from fastapi import Depends, Query

from app.core.config import Settings, get_settings
from app.core.errors import ApiError, bad_request
from app.utils import mock_data


def parse_time(value: str, field: str = "time") -> datetime:
    """Parse the simulated "now" and check it is inside meta.time_range."""
    # An unencoded "+08:00" in a query string arrives as " 08:00".
    value = re.sub(r" (\d{2}:\d{2})$", r"+\1", value.strip())
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        raise bad_request(f"{field} must be ISO 8601 with offset, e.g. 2026-03-30T14:00:00+08:00")
    if parsed.tzinfo is None:
        raise bad_request(f"{field} must include a UTC offset, e.g. +08:00")

    time_range = mock_data.meta()["time_range"]
    start = datetime.fromisoformat(time_range["start"])
    end = datetime.fromisoformat(time_range["end"])
    if not start <= parsed <= end:
        raise bad_request(f"{field} must be between {time_range['start']} and {time_range['end']}")
    return parsed


def sim_time(time: str = Query(..., description='Simulated "now", ISO 8601 with +08:00')) -> datetime:
    return parse_time(time)


def require_mock(settings: Settings = Depends(get_settings)) -> None:
    # Real-data mode arrives with the services layer; until then only MOCK=1 works.
    if not settings.mock:
        raise ApiError(500, "Real data mode is not implemented yet; set MOCK=1")
