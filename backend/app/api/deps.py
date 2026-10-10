import re
from datetime import datetime
from typing import Any

from fastapi import Depends, Query, Request

from app.core.config import Settings, get_settings
from app.core.errors import bad_request
from app.services import views
from app.services.data_loader import DataStore
from app.utils import mock_data


def get_firestore(request: Request) -> Any | None:
    """The initialized backend-only Firestore client, when configured."""
    return getattr(request.app.state, "firestore", None)


def get_data(request: Request, settings: Settings = Depends(get_settings)) -> DataStore | None:
    """The loaded ML files, or None in mock mode."""
    return None if settings.mock else request.app.state.data


def get_meta(data: DataStore | None = Depends(get_data)) -> dict[str, Any]:
    return mock_data.meta() if data is None else views.build_meta(data)


def parse_time(value: str, meta: dict[str, Any], field: str = "time") -> datetime:
    """Parse the simulated "now" and check it is inside meta.time_range."""
    # An unencoded "+08:00" in a query string arrives as " 08:00".
    value = re.sub(r" (\d{2}:\d{2})$", r"+\1", value.strip())
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        raise bad_request(f"{field} must be ISO 8601 with offset, e.g. 2026-03-30T14:00:00+08:00")
    if parsed.tzinfo is None:
        raise bad_request(f"{field} must include a UTC offset, e.g. +08:00")

    time_range = meta["time_range"]
    start = datetime.fromisoformat(time_range["start"])
    end = datetime.fromisoformat(time_range["end"])
    if not start <= parsed <= end:
        raise bad_request(f"{field} must be between {time_range['start']} and {time_range['end']}")
    return parsed


def sim_time(
    time: str = Query(..., description='Simulated "now", ISO 8601 with +08:00'),
    meta: dict[str, Any] = Depends(get_meta),
) -> datetime:
    return parse_time(time, meta)
