from fastapi.testclient import TestClient

from app.utils import mock_data

TIME = "2026-03-26T14:00:00+08:00"
ACTION_ID = "degraded:stn_003:stn_003_c1"


def test_health(client: TestClient) -> None:
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["mock"] is True


def test_meta(client: TestClient) -> None:
    body = client.get("/api/meta").json()
    assert body["corridor_name"] == mock_data.META["corridor_name"]
    assert body["time_range"]["start"] == "2026-03-16T00:00:00+08:00"
    assert body["assumptions"]["rm_per_session"] == 35.0


def test_stations(client: TestClient) -> None:
    res = client.get("/api/stations", params={"time": TIME})
    assert res.status_code == 200
    assert res.json()[0] == {
        "id": "stn_003", "name": "Seremban R&R", "lat": 2.725, "lon": 101.94,
        "n_chargers": 4, "n_working": 3, "power_kw": 60,
        "predicted_wait_min": 55.0, "level": "red", "open_issue_count": 2,
    }


def test_time_with_unencoded_plus(client: TestClient) -> None:
    # A raw "+" in a query string is decoded as a space.
    res = client.get(f"/api/stations?time={TIME}")
    assert res.status_code == 200


def test_forecast(client: TestClient) -> None:
    res = client.get("/api/stations/stn_003/forecast", params={"start": TIME, "hours": 2})
    slots = res.json()
    assert res.status_code == 200
    assert len(slots) == 4
    assert slots[0]["slot_start"] == TIME
    assert slots[1]["slot_start"] == "2026-03-26T14:30:00+08:00"


def test_charger_health(client: TestClient) -> None:
    body = client.get("/api/chargers/stn_003_c1/health", params={"time": TIME}).json()
    assert body["status"] == "degraded"
    assert body["degraded_since"] == "2026-03-23"
    assert body["series"][0] == {"date": "2026-03-20", "ratio": 0.95, "baseline": 0.94}


def test_actions(client: TestClient) -> None:
    body = client.get("/api/actions", params={"time": TIME, "limit": 1}).json()
    assert len(body) == 1
    assert body[0]["id"] == ACTION_ID
    assert body[0]["deadline"] == "2026-03-26T18:00:00+08:00"


def test_advice(client: TestClient) -> None:
    res = client.post(f"/api/actions/{ACTION_ID}/advice", json={"time": TIME, "language": "en"})
    assert res.status_code == 200
    assert res.json()["action_id"] == ACTION_ID
    assert res.json()["source"] == "llm"


def test_whatif(client: TestClient) -> None:
    res = client.post(
        "/api/whatif",
        json={"scenario": "fix_now", "time": TIME, "station_id": "stn_003", "charger_id": "stn_003_c1"},
    )
    assert res.status_code == 200
    assert res.json()["after_wait_min"] == 24.0


def test_backtest(client: TestClient) -> None:
    res = client.get("/api/backtest")
    assert res.status_code == 200
    assert res.json()["daily"]


def test_missing_time_is_bad_request(client: TestClient) -> None:
    res = client.get("/api/stations")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "bad_request"


def test_time_outside_range_is_bad_request(client: TestClient) -> None:
    res = client.get("/api/stations", params={"time": "2027-01-01T00:00:00+08:00"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "bad_request"


def test_unknown_station_is_not_found(client: TestClient) -> None:
    res = client.get("/api/stations/stn_999/forecast", params={"start": TIME})
    assert res.status_code == 404
    assert res.json() == {"error": {"code": "not_found", "message": "Station stn_999 does not exist"}}


def test_unknown_route_uses_error_format(client: TestClient) -> None:
    res = client.get("/api/nope")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"
