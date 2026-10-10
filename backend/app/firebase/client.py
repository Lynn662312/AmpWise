"""Firebase Admin initialization and Firestore action-status helpers."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import Client

_APP_NAME = "ampwise"
_COLLECTION = "actions_status"


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
