import time as clock
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.services.data_loader import DataStore
from app.services.priority import build_action_list

MYT = timezone(timedelta(hours=8))
NORMAL_TUESDAY = datetime(2026, 3, 17, 14, 0, tzinfo=MYT)
DAY_BEFORE_RAYA = datetime(2026, 3, 26, 14, 0, tzinfo=MYT)
RAYA_PARAM = "2026-03-26T14:00:00+08:00"


def test_safety_fault_is_first_then_rm_descending(data: DataStore) -> None:
    actions = build_action_list(data, DAY_BEFORE_RAYA)
    assert actions[0]["issue_type"] == "safety_fault"
    assert actions[0]["urgency"] == "critical"
    rest = [a["rm_at_risk"] for a in actions if a["issue_type"] != "safety_fault"]
    assert rest == sorted(rest, reverse=True)
    assert [a["rank"] for a in actions] == list(range(1, len(actions) + 1))


def test_action_ids_follow_the_contract(data: DataStore) -> None:
    ids = {a["id"] for a in build_action_list(data, DAY_BEFORE_RAYA)}
    assert "degraded:stn_003:stn_003_c1" in ids
    assert "chronic_undercapacity:stn_004:-" in ids


def test_broken_charger_costs_more_before_the_festive_peak(data: DataStore) -> None:
    # No charger is faulty yet on the normal Tuesday.
    normal = build_action_list(data, NORMAL_TUESDAY)
    assert all(a["charger_id"] is None for a in normal)

    degraded = next(a for a in build_action_list(data, DAY_BEFORE_RAYA) if a["id"] == "degraded:stn_003:stn_003_c1")
    assert degraded["rm_at_risk"] > 0
    assert degraded["deadline"] is not None
    assert "Charger 1 at Seremban R&R" in degraded["reason"]
    assert "41% of rated power" in degraded["reason"]


def test_limit(data: DataStore) -> None:
    assert len(build_action_list(data, DAY_BEFORE_RAYA, limit=2)) == 2


def test_actions_endpoint_is_fast(real_client: TestClient) -> None:
    started = clock.perf_counter()
    res = real_client.get("/api/actions", params={"time": RAYA_PARAM})
    assert res.status_code == 200
    assert res.json()[0]["issue_type"] == "safety_fault"
    assert clock.perf_counter() - started < 1.0


def test_stations_endpoint_uses_data(real_client: TestClient) -> None:
    stations = {s["id"]: s for s in real_client.get("/api/stations", params={"time": RAYA_PARAM}).json()}
    assert len(stations) == 5
    assert stations["stn_003"]["n_working"] == 3
    assert stations["stn_003"]["open_issue_count"] >= 1
    assert stations["stn_001"]["level"] == "green"


def test_forecast_endpoint_uses_data(real_client: TestClient) -> None:
    res = real_client.get("/api/stations/stn_003/forecast", params={"start": RAYA_PARAM, "hours": 24})
    slots = res.json()
    assert len(slots) == 48
    assert slots[0]["slot_start"] == RAYA_PARAM
    assert any(s["is_festive"] for s in slots)


def test_charger_health_endpoint_uses_data(real_client: TestClient) -> None:
    body = real_client.get("/api/chargers/stn_003_c1/health", params={"time": RAYA_PARAM, "days": 7}).json()
    assert body["status"] == "degraded"
    assert body["degraded_since"] == "2026-03-23"
    assert len(body["series"]) == 7
    assert body["series"][-1]["date"] == "2026-03-26"


def test_meta_endpoint_uses_data(real_client: TestClient) -> None:
    body = real_client.get("/api/meta").json()
    assert body["time_range"] == {"start": "2026-03-16T00:00:00+08:00", "end": "2026-04-05T23:30:00+08:00"}


def test_unknown_ids_are_not_found(real_client: TestClient) -> None:
    assert real_client.get("/api/chargers/stn_999_c1/health", params={"time": RAYA_PARAM}).status_code == 404
    assert real_client.get("/api/stations/stn_999/forecast", params={"start": RAYA_PARAM}).status_code == 404
