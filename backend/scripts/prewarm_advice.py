"""Fills the running server's advice cache for every demo time.

Run from backend/ while the server is up:
    python -m scripts.prewarm_advice http://localhost:8000
Run it again after every server restart (the cache lives in memory).
"""

import sys

import httpx

LANGUAGES = ["en"]  # add "zh" or "ms" if the demo shows them


def prewarm(base_url: str) -> None:
    api = httpx.Client(base_url=f"{base_url.rstrip('/')}/api", timeout=30)
    for demo in api.get("/meta").json()["demo_times"]:
        actions = api.get("/actions", params={"time": demo["time"]}).json()
        for action in actions:
            for language in LANGUAGES:
                body = {"time": demo["time"], "language": language}
                advice = api.post(f"/actions/{action['id']}/advice", json=body).json()
                print(f"{demo['label']} | {action['id']} | {language} -> {advice['source']}")


if __name__ == "__main__":
    prewarm(sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000")
