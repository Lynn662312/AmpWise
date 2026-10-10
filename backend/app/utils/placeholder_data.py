"""Temporary deterministic responses for backend features without a data source.

Each fixture is deliberately separate from ML files so the backend team can
replace it with a service backed by approved session and uptime data.
"""

from typing import Any


OVERVIEW: dict[str, Any] = {
    "data_source": "placeholder",
    "energy_delivered_kwh": 1284.0,
    "energy_delivered_week_kwh": 8492.0,
    "live_sessions": 42,
    "network_uptime_pct": 99.2,
    "energy_trend": [
        {"date": "2019-12-01", "kwh": 1100.0},
        {"date": "2019-12-02", "kwh": 1240.0},
        {"date": "2019-12-03", "kwh": 1180.0},
        {"date": "2019-12-04", "kwh": 1390.0},
        {"date": "2019-12-05", "kwh": 1320.0},
        {"date": "2019-12-06", "kwh": 1610.0},
        {"date": "2019-12-07", "kwh": 1572.0},
    ],
}


def overview() -> dict[str, Any]:
    return {
        **OVERVIEW,
        "energy_trend": [*OVERVIEW["energy_trend"]],
    }
