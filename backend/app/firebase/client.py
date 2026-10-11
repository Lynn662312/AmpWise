"""Firebase Admin initialization and the Firestore helpers: action status and saved what-if runs."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import Client

_APP_NAME = "ampwise"
_COLLECTION = "actions_status"
_SCENARIOS = "scenarios"
MAX_SCENARIOS = 30  # there is no login, so the number of saved runs is capped


def initialize_firestore(credentials_value: str) -> Client | None:
    """Create the backend-only Firestore client from JSON or a key-file path."""
    value = credentials_value.strip()
    if not value:
        return None

    try:
        app = firebase_admin.get_app(_APP_NAME)
    except ValueError:
        certificate: dict[str, Any] | str
        if value.startswith("{"):
            certificate = json.loads(value)
        else:
            path = Path(value).expanduser()
            if not path.is_file():
                raise ValueError("FIREBASE_CREDENTIALS is neither JSON nor an existing file")
            certificate = str(path)
        app = firebase_admin.initialize_app(credentials.Certificate(certificate), name=_APP_NAME)

    return firestore.client(app=app)


def read_action_states(client: Client, action_ids: list[str]) -> dict[str, str]:
    """Return stored states for the requested actions; missing docs remain open."""
    if not action_ids:
        return {}
    collection = client.collection(_COLLECTION)
    snapshots = client.get_all(collection.document(action_id) for action_id in action_ids)
    states: dict[str, str] = {}
    for snapshot in snapshots:
        if not snapshot.exists:
            continue
        value = snapshot.to_dict().get("state")
        if value in {"assigned", "done"}:
            states[snapshot.id] = value
    return states


def write_action_state(client: Client, action_id: str, state: str) -> None:
    """Persist an operator-owned state without storing model output."""
    client.collection(_COLLECTION).document(action_id).set(
        {"state": state, "updated_at": firestore.SERVER_TIMESTAMP},
        merge=True,
    )


def read_done_action_ids(client: Client) -> list[str]:
    """Ids of every action marked done, read once at start-up."""
    return [doc.id for doc in client.collection(_COLLECTION).stream() if doc.to_dict().get("state") == "done"]


def _clear(client: Client, collection: str) -> int:
    docs = list(client.collection(collection).stream())
    for doc in docs:
        doc.reference.delete()
    return len(docs)


def clear_action_states(client: Client) -> int:
    return _clear(client, _COLLECTION)


def clear_scenarios(client: Client) -> int:
    return _clear(client, _SCENARIOS)


def list_scenarios(client: Client) -> list[dict[str, Any]]:
    """Saved what-if runs, newest first."""
    query = client.collection(_SCENARIOS).order_by("created_at", direction=firestore.Query.DESCENDING)
    return [
        {"id": doc.id, **{key: doc.to_dict()[key] for key in ("name", "request", "result")}}
        for doc in query.limit(MAX_SCENARIOS).stream()
    ]


def add_scenario(client: Client, scenario: dict[str, Any]) -> str:
    """Store one what-if run and return its new id."""
    _, document = client.collection(_SCENARIOS).add({**scenario, "created_at": firestore.SERVER_TIMESTAMP})
    return document.id
