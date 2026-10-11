from typing import Any

from fastapi.testclient import TestClient

from app.api.deps import get_firestore
from app.firebase import client as firebase_store
from app.main import app

TIME = "2026-03-26T14:00:00+08:00"
ACTION_ID = "degraded:stn_003:stn_003_c1"


def test_action_status_round_trip(client: TestClient, monkeypatch: Any) -> None:
    fake_firestore = object()
    writes: list[tuple[str, str]] = []
    state = {"value": "assigned"}

    monkeypatch.setattr(
        firebase_store,
        "read_action_states",
        lambda _client, action_ids: {ACTION_ID: state["value"]} if ACTION_ID in action_ids else {},
    )

    def write_state(_client: Any, action_id: str, value: str) -> None:
        writes.append((action_id, value))
        state["value"] = value

    monkeypatch.setattr(firebase_store, "write_action_state", write_state)
    app.dependency_overrides[get_firestore] = lambda: fake_firestore
    try:
        listed = client.get("/api/actions", params={"time": TIME, "limit": 10})
        assert listed.status_code == 200
        assert listed.json()[0]["state"] == "assigned"

        updated = client.patch(f"/api/actions/{ACTION_ID}/status", json={"state": "done"})
        assert updated.status_code == 200
        assert updated.json()["state"] == "done"
        assert writes == [(ACTION_ID, "done")]

        refreshed = client.get("/api/actions", params={"time": TIME, "limit": 10})
        assert refreshed.status_code == 200
        completed = next(action for action in refreshed.json() if action["id"] == ACTION_ID)
        assert completed["state"] == "done"
    finally:
        app.dependency_overrides.pop(get_firestore, None)


def test_action_status_accepts_only_the_three_states(client: TestClient) -> None:
    client.get("/api/actions", params={"time": TIME, "limit": 10})
    reopened = client.patch(f"/api/actions/{ACTION_ID}/status", json={"state": "open"})
    assert reopened.status_code == 200 and reopened.json()["state"] == "open"
    assert client.patch(f"/api/actions/{ACTION_ID}/status", json={"state": "closed"}).status_code == 400
