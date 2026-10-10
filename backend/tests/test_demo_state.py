"""Marking an action done, demo reset and saved what-if runs, with Firestore replaced by a dict."""

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_firestore
from app.core.config import Settings, get_settings
from app.firebase import client as firebase_store
from app.main import app
from app.services.data_loader import DataStore

TIME = "2026-03-26T14:00:00+08:00"  # dummy data: Charger 1 at stn_003 is degraded
STATION, CHARGER = "stn_003", "stn_003_c1"
ACTION_ID = f"degraded:{STATION}:{CHARGER}"
WHATIF = {"scenario": "fix_now", "time": TIME, "station_id": STATION, "charger_id": CHARGER}


@pytest.fixture
def store(monkeypatch: pytest.MonkeyPatch, data: DataStore) -> Iterator[dict[str, Any]]:
    """An in-memory stand-in for the two Firestore collections."""
    memory: dict[str, Any] = {"states": {}, "scenarios": []}

    def clear(key: str) -> int:
        count = len(memory[key])
        memory[key].clear()
        return count

    def add_scenario(_client: Any, scenario: dict[str, Any]) -> str:
        memory["scenarios"].insert(0, {"id": f"s{len(memory['scenarios']) + 1}", **scenario})
        return memory["scenarios"][0]["id"]

    monkeypatch.setattr(firebase_store, "read_action_states", lambda _c, ids: {i: memory["states"][i] for i in ids if i in memory["states"]})
    monkeypatch.setattr(firebase_store, "write_action_state", lambda _c, action_id, state: memory["states"].update({action_id: state}))
    monkeypatch.setattr(firebase_store, "clear_action_states", lambda _c: clear("states"))
    monkeypatch.setattr(firebase_store, "clear_scenarios", lambda _c: clear("scenarios"))
    monkeypatch.setattr(firebase_store, "list_scenarios", lambda _c: memory["scenarios"][: firebase_store.MAX_SCENARIOS])
    monkeypatch.setattr(firebase_store, "add_scenario", add_scenario)
    app.dependency_overrides[get_firestore] = lambda: object()
    yield memory
    app.dependency_overrides.pop(get_firestore, None)
    data.repaired.clear()


def _station(client: TestClient) -> dict[str, Any]:
    stations = client.get("/api/stations", params={"time": TIME}).json()
    return next(s for s in stations if s["id"] == STATION)


def _action(client: TestClient) -> dict[str, Any]:
    actions = client.get("/api/actions", params={"time": TIME, "limit": 50}).json()
    return next(a for a in actions if a["id"] == ACTION_ID)


def test_a_charger_action_marked_done_counts_as_working_again(real_client: TestClient, store: dict[str, Any]) -> None:
    before, action = _station(real_client), _action(real_client)

    done = real_client.patch(f"/api/actions/{ACTION_ID}/status", json={"state": "done"})
    assert done.status_code == 200 and done.json()["state"] == "done"

    after = _station(real_client)
    assert after["n_working"] == before["n_working"] + 1
    assert after["open_issue_count"] == before["open_issue_count"] - 1
    assert after["predicted_wait_min"] <= before["predicted_wait_min"]
    chargers = real_client.get(f"/api/stations/{STATION}/chargers", params={"time": TIME}).json()
    assert next(c for c in chargers if c["charger_id"] == CHARGER)["status"] == "healthy"

    # The action stays on the list as done, with the value it had before the repair.
    listed = _action(real_client)
    assert listed["state"] == "done"
    assert listed["rm_at_risk"] == action["rm_at_risk"]
    assert listed["reason"] == action["reason"]

    # Repairing it again in a what-if changes nothing.
    again = real_client.post("/api/whatif", json=WHATIF).json()
    assert again["before_revenue_rm"] == again["after_revenue_rm"]


def test_an_action_moved_back_to_assigned_is_not_working(real_client: TestClient, store: dict[str, Any]) -> None:
    before = _station(real_client)
    _action(real_client)
    real_client.patch(f"/api/actions/{ACTION_ID}/status", json={"state": "done"})
    real_client.patch(f"/api/actions/{ACTION_ID}/status", json={"state": "assigned"})
    assert _station(real_client)["n_working"] == before["n_working"]


def test_demo_reset_opens_every_action_again(real_client: TestClient, store: dict[str, Any]) -> None:
    before = _station(real_client)
    _action(real_client)
    real_client.patch(f"/api/actions/{ACTION_ID}/status", json={"state": "done"})
    store["scenarios"].append({"id": "s1"})

    reset = real_client.post("/api/demo/reset", json={"clear_scenarios": False})
    assert reset.status_code == 200
    assert reset.json() == {"cleared_actions": 1, "cleared_scenarios": 0}
    assert _action(real_client)["state"] == "open"
    assert _station(real_client)["n_working"] == before["n_working"]

    # The body is optional, and the saved runs go only when asked.
    assert real_client.post("/api/demo/reset").json() == {"cleared_actions": 0, "cleared_scenarios": 0}
    assert real_client.post("/api/demo/reset", json={"clear_scenarios": True}).json()["cleared_scenarios"] == 1


def test_a_what_if_run_can_be_saved_and_listed(real_client: TestClient, store: dict[str, Any]) -> None:
    result = real_client.post("/api/whatif", json=WHATIF).json()
    saved = real_client.post("/api/scenarios", json={"name": "Fix Charger 1", "request": WHATIF, "result": result})
    assert saved.status_code == 201
    assert saved.json()["id"] == "s1"
    assert saved.json()["result"] == result

    real_client.post("/api/scenarios", json={"name": "Second run", "request": WHATIF, "result": result})
    listed = real_client.get("/api/scenarios").json()
    assert [s["name"] for s in listed] == ["Second run", "Fix Charger 1"]  # newest first


def test_saved_runs_are_checked_and_capped(real_client: TestClient, store: dict[str, Any]) -> None:
    result = real_client.post("/api/whatif", json=WHATIF).json()
    body = {"name": "x" * 81, "request": WHATIF, "result": result}
    assert real_client.post("/api/scenarios", json=body).status_code == 400  # name too long
    assert real_client.post("/api/scenarios", json={"name": "No result", "request": WHATIF}).status_code == 400

    store["scenarios"].extend({"id": str(n), "name": "run", "request": WHATIF, "result": result} for n in range(30))
    full = real_client.post("/api/scenarios", json={**body, "name": "One too many"})
    assert full.status_code == 400
    assert "Reset the demo" in full.json()["error"]["message"]


def test_mock_mode_answers_without_firestore(client: TestClient) -> None:
    assert client.post("/api/demo/reset").json() == {"cleared_actions": 0, "cleared_scenarios": 0}
    assert client.get("/api/scenarios").json() == []
    result = client.post("/api/whatif", json=WHATIF).json()
    saved = client.post("/api/scenarios", json={"name": "Mock", "request": WHATIF, "result": result})
    assert saved.status_code == 201 and saved.json()["id"] == "mock"


def test_the_real_api_says_when_firestore_is_not_configured(real_client: TestClient) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(mock=False)
    for response in (real_client.post("/api/demo/reset"), real_client.get("/api/scenarios")):
        assert response.status_code == 500
        assert response.json()["error"]["message"] == "Firestore is not configured"
