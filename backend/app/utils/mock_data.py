"""Mock responses for MOCK=1, taken from the examples in docs/api_contract.md.

The contract shows one row per list; a few extra rows with the same shape are
added so the map and the action list have something to render.
"""

from datetime import datetime, timedelta
from typing import Any

from app.core.errors import not_found

META: dict[str, Any] = {
    "corridor_name": "KL – Penang (PLUS E1)",
    "currency": "RM",
    "time_range": {"start": "2026-03-16T00:00:00+08:00", "end": "2026-04-05T23:30:00+08:00"},
    "festive_periods": [
        {"name": "Hari Raya exodus", "start": "2026-03-27T00:00:00+08:00", "end": "2026-03-30T23:30:00+08:00"}
    ],
    "demo_times": [
        {"label": "Normal Tuesday", "time": "2026-03-17T14:00:00+08:00"},
        {"label": "Day before Raya exodus", "time": "2026-03-26T14:00:00+08:00"},
    ],
    "backtest_weeks": [{"value": "2026-03-23", "label": "Week of 23 Mar 2026"}],
    "assumptions": {"rm_per_session": 35.0, "avg_charge_min": 38},
}

STATIONS: list[dict[str, Any]] = [
    {
        "id": "stn_003", "name": "Seremban R&R", "lat": 2.725, "lon": 101.94,
        "n_chargers": 4, "n_working": 3, "power_kw": 60,
        "predicted_wait_min": 55.0, "level": "red", "open_issue_count": 2,
    },
    {
        "id": "stn_002", "name": "Nilai R&R", "lat": 2.815, "lon": 101.80,
        "n_chargers": 4, "n_working": 4, "power_kw": 60,
        "predicted_wait_min": 22.5, "level": "amber", "open_issue_count": 1,
    },
    {
        "id": "stn_001", "name": "Dengkil R&R", "lat": 2.86, "lon": 101.68,
        "n_chargers": 6, "n_working": 6, "power_kw": 120,
        "predicted_wait_min": 4.0, "level": "green", "open_issue_count": 0,
    },
]

ACTIONS: list[dict[str, Any]] = [
    {
        "id": "degraded:stn_003:stn_003_c1", "rank": 1,
        "issue_type": "degraded", "station_id": "stn_003", "station_name": "Seremban R&R",
        "charger_id": "stn_003_c1", "recommended_action": "Schedule maintenance",
        "rm_at_risk": 2300.00, "deadline": "2026-03-26T18:00:00+08:00", "urgency": "high",
        "reason": (
            "Fix Charger 1 at Seremban R&R by Thursday 6pm. It is delivering 41% of rated power, "
            "and Friday's forecast is a 55-minute queue."
        ),
        "state": "open",
    },
    {
        "id": "congestion:stn_002:-", "rank": 2,
        "issue_type": "congestion", "station_id": "stn_002", "station_name": "Nilai R&R",
        "charger_id": None, "recommended_action": "Redirect drivers",
        "rm_at_risk": 700.00, "deadline": None, "urgency": "medium",
        "reason": "Nilai R&R is forecast to reach a 22.5-minute queue during Friday's peak.",
        "state": "open",
    },
]

CHARGER_HEALTH: dict[str, Any] = {
    "charger_id": "stn_003_c1", "station_id": "stn_003",
    "status": "degraded", "p_fault": 0.86,
    "evidence": ["Power at 41% of 7-day median for 4 sessions", "Session success rate 92% (normal)"],
    "series": [
        {"date": "2026-03-20", "ratio": 0.95, "baseline": 0.94},
        {"date": "2026-03-24", "ratio": 0.41, "baseline": 0.93},
    ],
    "degraded_since": "2026-03-23",
}

ADVICE: dict[str, Any] = {
    "action_id": "degraded:stn_003:stn_003_c1",
    "summary": (
        "Charger 1 has delivered under half its rated power since Monday. Fixing it before Friday "
        "keeps the Raya peak queue near 25 minutes instead of 55."
    ),
    "steps": [
        "Dispatch a technician before Thursday 6pm",
        "Check power module and cable temperature",
        "If not fixable in time, redirect drivers to Nilai R&R via the app",
    ],
    "caveats": ["RM per session is an assumed RM 35"],
    "source": "llm",
    "cached": False,
}

WHATIF: dict[str, Any] = {
    "before_wait_min": 55.0, "after_wait_min": 24.0,
    "before_revenue_rm": 6100.00, "after_revenue_rm": 8400.00,
    "summary": "Fixing Charger 1 now cuts Friday's peak wait from 55 to 24 minutes and protects about RM 2,300.",
}

# The contract gives no example for BacktestResult; these values are placeholders.
BACKTEST: dict[str, Any] = {
    "week_label": "Hari Raya 2026",
    "queue_minutes_saved": 1840.0,
    "rm_protected": 5200.00,
    "forecast_mae_ours": 1.8,
    "forecast_mae_baseline": 3.1,
    "fault_precision": 0.88,
    "fault_recall": 0.81,
    "daily": [
        {"date": "2026-03-26", "wait_baseline_min": 31.0, "wait_ours_min": 19.0},
        {"date": "2026-03-27", "wait_baseline_min": 58.0, "wait_ours_min": 27.0},
        {"date": "2026-03-28", "wait_baseline_min": 52.0, "wait_ours_min": 25.0},
        {"date": "2026-03-29", "wait_baseline_min": 44.0, "wait_ours_min": 22.0},
        {"date": "2026-03-30", "wait_baseline_min": 47.0, "wait_ours_min": 24.0},
    ],
}

REPORT_CATEGORIES: list[dict[str, Any]] = [
    {"category": "Blocked by non-EV", "count": 314, "percentage": 23.3},
    {"category": "Other", "count": 269, "percentage": 20.0},
    {"category": "Slow charging", "count": 262, "percentage": 19.5},
    {"category": "Won't start", "count": 199, "percentage": 14.8},
    {"category": "Cleanliness", "count": 107, "percentage": 7.9},
    {"category": "Payment issue", "count": 72, "percentage": 5.3},
    {"category": "Connector damaged", "count": 47, "percentage": 3.5},
    {"category": "Cable stuck", "count": 40, "percentage": 3.0},
    {"category": "Screen broken", "count": 37, "percentage": 2.7},
]


def meta() -> dict[str, Any]:
    return META


def stations() -> list[dict[str, Any]]:
    return STATIONS


def _require_station(station_id: str) -> None:
    if not any(s["id"] == station_id for s in STATIONS):
        raise not_found(f"Station {station_id} does not exist")


def station_chargers(station_id: str) -> list[dict[str, Any]]:
    """Mock only: the first chargers are the broken ones. Real ids come from the sensor data."""
    _require_station(station_id)
    station = next(s for s in STATIONS if s["id"] == station_id)
    n_broken = station["n_chargers"] - station["n_working"]
    return [
        {
            "charger_id": f"{station_id}_c{n}",
            "station_id": station_id,
            "power_kw": station["power_kw"],
            "status": "degraded" if n <= n_broken else "healthy",
        }
        for n in range(1, station["n_chargers"] + 1)
    ]


def forecast(station_id: str, start: datetime, hours: int) -> list[dict[str, Any]]:
    """The contract's example slot, repeated every 30 minutes across the window."""
    _require_station(station_id)
    return [
        {
            "slot_start": (start + timedelta(minutes=30 * i)).isoformat(),
            "arrivals": 9.4, "arrivals_baseline": 6.0, "wait_min": 22.5, "is_festive": False,
        }
        for i in range(hours * 2)
    ]


def charger_health(charger_id: str) -> dict[str, Any]:
    station_id = charger_id.rsplit("_", 1)[0]
    _require_station(station_id)
    return {**CHARGER_HEALTH, "charger_id": charger_id, "station_id": station_id}


CHARGER_EVENTS: list[dict[str, Any]] = [
    {"time": "2026-03-25T15:00:00+08:00", "source": "driver",
     "message": "Driver report (Slow charging): Charging is crawling, barely getting any power"},
    {"time": "2026-03-23T09:10:00+08:00", "source": "sensor", "message": "Charger reported PowerMeterFailure"},
]


def charger_events(charger_id: str) -> list[dict[str, Any]]:
    _require_station(charger_id.rsplit("_", 1)[0])
    return CHARGER_EVENTS


def actions(limit: int) -> list[dict[str, Any]]:
    return ACTIONS[:limit]


def advice(action_id: str) -> dict[str, Any]:
    if not any(a["id"] == action_id for a in ACTIONS):
        raise not_found(f"Action {action_id} does not exist")
    return {**ADVICE, "action_id": action_id}


def whatif(station_id: str) -> dict[str, Any]:
    _require_station(station_id)
    return WHATIF


def backtest() -> dict[str, Any]:
    return BACKTEST


def report_categories() -> list[dict[str, Any]]:
    return REPORT_CATEGORIES
