from datetime import datetime, timedelta, timezone

import anthropic
import httpx2
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.services import llm
from app.services.data_loader import DataStore
from app.services.priority import build_action_list
from scripts.check_data import check
from scripts.make_dummy_data import write_dummy_data

MYT = timezone(timedelta(hours=8))
DAY_BEFORE_RAYA = datetime(2026, 3, 26, 14, 0, tzinfo=MYT)
RAYA_PARAM = "2026-03-26T14:00:00+08:00"
ACTION_ID = "degraded:stn_003:stn_003_c1"

WITH_KEY = Settings(llm_api_key="test-key", llm_model="test-model")
NO_KEY = Settings(llm_api_key="", llm_model="")
GOOD_ADVICE = {
    "summary": "Charger 1 is delivering 41% of rated power before the festive peak.",
    "steps": ["Dispatch a technician", "Check the power module"],
    "caveats": ["RM per session is an assumed RM 35"],
}


@pytest.fixture(autouse=True)
def empty_cache() -> None:
    llm._cache.clear()


def _facts(data: DataStore) -> dict:
    action = next(a for a in build_action_list(data, DAY_BEFORE_RAYA) if a["id"] == ACTION_ID)
    return llm.build_facts(data, action, DAY_BEFORE_RAYA)


def test_build_facts_has_action_health_and_forecast(data: DataStore) -> None:
    facts = _facts(data)
    assert facts["action"]["id"] == ACTION_ID
    assert facts["charger_health"]["power_ratio"] == 0.41
    assert facts["station"] == {"n_chargers": 4, "n_working": 3}
    assert facts["assumptions"]["rm_per_session"] == 35.0


def test_check_numbers(data: DataStore) -> None:
    facts = _facts(data)
    assert llm.check_numbers(GOOD_ADVICE, facts)
    invented = {**GOOD_ADVICE, "summary": "This will cost RM 99999 a day."}
    assert not llm.check_numbers(invented, facts)


def test_ai_advice_is_returned_then_cached(data: DataStore, monkeypatch: pytest.MonkeyPatch) -> None:
    calls = []
    monkeypatch.setattr(llm, "generate_advice", lambda *args: calls.append(1) or GOOD_ADVICE)

    first = llm.get_advice(data, WITH_KEY, ACTION_ID, DAY_BEFORE_RAYA, "en")
    second = llm.get_advice(data, WITH_KEY, ACTION_ID, DAY_BEFORE_RAYA, "en")
    assert (first["source"], first["cached"]) == ("llm", False)
    assert (second["source"], second["cached"]) == ("llm", True)
    assert len(calls) == 1


def test_template_when_ai_fails(data: DataStore, monkeypatch: pytest.MonkeyPatch) -> None:
    def timeout(*args):
        raise anthropic.APITimeoutError(request=httpx2.Request("POST", "https://api.anthropic.com"))

    monkeypatch.setattr(llm, "generate_advice", timeout)
    advice = llm.get_advice(data, WITH_KEY, ACTION_ID, DAY_BEFORE_RAYA, "en")
    assert advice["source"] == "template"
    assert "Charger 1 at Seremban R&R" in advice["summary"]
    assert len(advice["steps"]) >= 2


def test_template_when_ai_invents_numbers(data: DataStore, monkeypatch: pytest.MonkeyPatch) -> None:
    invented = {**GOOD_ADVICE, "summary": "This will cost RM 99999 a day."}
    monkeypatch.setattr(llm, "generate_advice", lambda *args: invented)
    assert llm.get_advice(data, WITH_KEY, ACTION_ID, DAY_BEFORE_RAYA, "en")["source"] == "template"


def test_provider_follows_model_name(data: DataStore, monkeypatch: pytest.MonkeyPatch) -> None:
    import json

    used = []
    answer = json.dumps(GOOD_ADVICE)
    monkeypatch.setattr(llm, "_ask_claude", lambda *args: used.append("claude") or answer)
    monkeypatch.setattr(llm, "_ask_openai_compatible", lambda *args: used.append("openai") or answer)

    for model in ("claude-opus-5-5", "gpt-example", "gemini-example"):
        advice = llm.generate_advice(_facts(data), "en", Settings(llm_api_key="k", llm_model=model))
        assert advice == GOOD_ADVICE
    assert used == ["claude", "openai", "openai"]


def test_ai_answer_with_wrong_shape_is_rejected(data: DataStore, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "_ask_claude", lambda *args: '{"summary": "only a summary"}')
    with pytest.raises(ValueError):
        llm.generate_advice(_facts(data), "en", Settings(llm_api_key="k", llm_model="claude-opus-5-5"))


def test_template_when_no_key(data: DataStore) -> None:
    assert llm.get_advice(data, NO_KEY, ACTION_ID, DAY_BEFORE_RAYA, "zh")["source"] == "template"


def test_advice_endpoint(real_client: TestClient) -> None:
    res = real_client.post(f"/api/actions/{ACTION_ID}/advice", json={"time": RAYA_PARAM, "language": "en"})
    assert res.status_code == 200
    assert res.json()["action_id"] == ACTION_ID

    missing = real_client.post("/api/actions/degraded:stn_999:stn_999_c1/advice", json={"time": RAYA_PARAM})
    assert missing.status_code == 404


def test_check_data_accepts_dummy_files_and_reports_problems(tmp_path, data: DataStore) -> None:
    write_dummy_data(str(tmp_path))
    assert check(str(tmp_path)) == []

    data.health.assign(status="broken").to_parquet(tmp_path / "health.parquet", index=False)
    assert any("unknown status" in problem for problem in check(str(tmp_path)))
