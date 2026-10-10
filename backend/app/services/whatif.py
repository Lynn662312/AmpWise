"""What-if: one decision, before vs after, over the next 72 hours."""

from datetime import datetime
from typing import Any

from app.core.errors import bad_request, not_found
from app.schemas import WhatIfRequest
from app.services.classifier import latest_health, working_chargers
from app.services.data_loader import DataStore
from app.services.priority import HORIZON_HOURS, outlook, upcoming_slots


def _compare(
    data: DataStore, station_id: str, time: datetime, chargers_before: int, chargers_after: int, what: str
) -> dict[str, Any]:
    slots = upcoming_slots(data, station_id, time, HORIZON_HOURS)
    before = outlook(data, slots, chargers_before)
    after = outlook(data, slots, chargers_after)

    # Revenue = the sessions the chargers can serve x revenue per session. The wait plays no part in it.
    rm_per_session = data.params["rm_per_session"]
    before_revenue = before["served"] * rm_per_session
    after_revenue = after["served"] * rm_per_session
    more_served = round(after["served"] - before["served"], 1)

    changes = []
    if after["peak_wait_min"] != before["peak_wait_min"]:
        changes.append(f"cuts the peak wait from {before['peak_wait_min']:.0f} to {after['peak_wait_min']:.0f} minutes")
    if more_served > 0:
        changes.append(
            f"serves an estimated {more_served:.1f} more sessions "
            f"(about {data.meta['currency']} {after_revenue - before_revenue:,.0f} of estimated revenue at risk)"
        )
    if changes:
        summary = f"{what} {' and '.join(changes)} over the next {HORIZON_HOURS} hours."
    else:
        summary = f"{what} does not change the queue or the sessions served over the next {HORIZON_HOURS} hours."
    return {
        "before_wait_min": before["peak_wait_min"],
        "after_wait_min": after["peak_wait_min"],
        "before_revenue_rm": round(before_revenue, 2),
        "after_revenue_rm": round(after_revenue, 2),
        "summary": summary,
    }


def _station_name(data: DataStore, station_id: str) -> str:
    names = data.stations.loc[data.stations["station_id"] == station_id, "name"]
    if names.empty:
        raise not_found(f"Station {station_id} does not exist")
    return names.iloc[0]


def simulate_fix(data: DataStore, station_id: str, charger_id: str, time: datetime) -> dict[str, Any]:
    """Fix this charger now vs leave it broken."""
    station = _station_name(data, station_id)
    health = latest_health(data, charger_id, time)
    if health is None or health["station_id"] != station_id:
        raise not_found(f"Charger {charger_id} does not exist at {station_id}")

    n_working = working_chargers(data, station_id, time)
    is_faulty = health["status"] != "healthy"
    label = f"Fixing Charger {charger_id.rsplit('_c', 1)[-1]} at {station} now"
    return _compare(data, station_id, time, n_working, n_working + int(is_faulty), label)


def simulate_add_chargers(data: DataStore, station_id: str, n: int, time: datetime) -> dict[str, Any]:
    station = _station_name(data, station_id)
    n_working = working_chargers(data, station_id, time)
    label = f"Adding {n} charger{'s' if n > 1 else ''} at {station}"
    return _compare(data, station_id, time, n_working, n_working + n, label)


def run_whatif(data: DataStore, request: WhatIfRequest, time: datetime) -> dict[str, Any]:
    if request.scenario == "fix_now":
        if not request.charger_id:
            raise bad_request("charger_id is required for the fix_now scenario")
        return simulate_fix(data, request.station_id, request.charger_id, time)
    if request.scenario == "add_chargers":
        if not request.n_chargers:
            raise bad_request("n_chargers is required for the add_chargers scenario")
        return simulate_add_chargers(data, request.station_id, request.n_chargers, time)
    raise bad_request("The discount scenario is not available yet")
