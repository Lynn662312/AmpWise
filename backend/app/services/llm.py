"""AI advice for one action. The AI explains and suggests steps; it never decides numbers.

Flow: build_facts -> generate_advice (8 s timeout) -> check_numbers -> cache.
Any failure returns fallback_advice instead, so the endpoint always answers.
"""

import json
import logging
import re
from datetime import datetime
from typing import Any

import anthropic
import openai

from app.core.config import Settings
from app.core.errors import not_found
from app.services.classifier import latest_health, recent_reports, working_chargers
from app.services.data_loader import DataStore
from app.services.priority import HORIZON_HOURS, build_action_list, outlook, upcoming_slots

logger = logging.getLogger(__name__)

TIMEOUT_S = 8.0
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
LANGUAGES = {"en": "English", "zh": "Simplified Chinese", "ms": "Bahasa Melayu"}

SYSTEM_PROMPT = """You write short operational advice for the operator of an EV charging network.

You receive a JSON object of facts about one item on the operator's priority list. The ranking, \
money values, fault status and wait times were calculated by the operator's own models and are \
displayed next to your text, so your text has to agree with them. Use only numbers that appear in \
the facts, written the way they appear there, and do not estimate or calculate new ones.

Reply with a JSON object that has exactly these keys:
- "summary" (string): one or two sentences on why this action matters now.
- "steps" (array of strings): two to five concrete things the operations team can do, most \
important first.
- "caveats" (array of strings): assumptions or uncertainty the operator should keep in mind, such \
as the assumed revenue per session. Money is in the currency given in the facts."""

ADVICE_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "steps": {"type": "array", "items": {"type": "string"}},
        "caveats": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "steps", "caveats"],
    "additionalProperties": False,
}

FALLBACK_STEPS: dict[str, list[str]] = {
    "safety_fault": ["Take the charger out of service now", "Send a technician to inspect the cable and connector"],
    "degraded": ["Dispatch a technician before the deadline", "Check the power module and cable temperature"],
    "connector_fault": ["Dispatch a technician before the deadline", "Inspect and replace the connector"],
    "user_reported": ["Send a technician to inspect the charger", "Mark it out of service if the fault is confirmed"],
    "congestion": ["Redirect drivers to nearby stations during the peak", "Post expected waiting times in the app"],
    "chronic_undercapacity": ["Plan additional chargers for this station", "Redirect drivers until capacity is added"],
    "underused": ["Review pricing at this station", "Consider moving a charger to a busier station"],
    "site_issue": ["Send site staff to check the bay", "Clear or clean the bay, then mark the action done"],
}

# (action_id, time, language) -> advice from the AI
_cache: dict[tuple[str, str, str], dict[str, Any]] = {}


def build_facts(data: DataStore, action: dict[str, Any], time: datetime) -> dict[str, Any]:
    """Everything the AI is allowed to know about this action."""
    station_id = action["station_id"]
    n_working = working_chargers(data, station_id, time)
    look = outlook(data, upcoming_slots(data, station_id, time, HORIZON_HOURS), n_working)
    n_chargers = int(data.stations.loc[data.stations["station_id"] == station_id, "n_chargers"].iloc[0])

    facts: dict[str, Any] = {
        "now": time.isoformat(),
        "action": {
            **{k: action[k] for k in ("id", "issue_type", "station_name", "charger_id", "recommended_action",
                                      "rm_at_risk", "urgency", "reason")},
            "deadline": action["deadline"].isoformat() if action["deadline"] else None,
        },
        "station": {"n_chargers": n_chargers, "n_working": n_working},
        "forecast_next_72h": {
            "peak_wait_min": look["peak_wait_min"],
            "peak_time": look["peak_time"].isoformat() if look["peak_time"] else None,
            "lost_sessions": round(look["lost"], 1),
        },
        "assumptions": {**data.params, "currency": data.meta["currency"]},
    }
    if action["charger_id"]:
        health = latest_health(data, action["charger_id"], time)
        facts["charger_health"] = {
            "status": health["status"],
            "p_fault": float(health["p_fault"]),
            "power_ratio": float(health["power_ratio"]),
            "evidence": health["evidence"],
            "driver_reports_last_7_days": len(recent_reports(data, action["charger_id"], time)),
        }
    return facts


def _ask_claude(prompt: str, settings: Settings) -> str:
    client = anthropic.Anthropic(api_key=settings.llm_api_key, timeout=TIMEOUT_S, max_retries=0)
    response = client.messages.create(
        model=settings.llm_model,
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
        # Low effort keeps the answer inside the 8-second limit.
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": ADVICE_SCHEMA}},
    )
    if response.stop_reason != "end_turn":
        raise ValueError(f"AI stopped early: {response.stop_reason}")
    return next((block.text for block in response.content if block.type == "text"), "")


def _ask_openai_compatible(prompt: str, settings: Settings) -> str:
    """OpenAI models, and Gemini models through Google's OpenAI-compatible endpoint."""
    base_url = GEMINI_BASE_URL if settings.llm_model.startswith("gemini") else None
    client = openai.OpenAI(api_key=settings.llm_api_key, base_url=base_url, timeout=TIMEOUT_S, max_retries=0)
    response = client.chat.completions.create(
        model=settings.llm_model,
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content or ""


def generate_advice(facts: dict[str, Any], language: str, settings: Settings) -> dict[str, Any]:
    """Ask the AI for summary, steps and caveats. Raises if the call fails or times out.

    The provider follows LLM_MODEL: names starting with "claude" go to Anthropic,
    "gemini" to Google, anything else to OpenAI.
    """
    prompt = (
        f"Write the advice in {LANGUAGES[language]}.\n\n"
        f"Facts:\n{json.dumps(facts, ensure_ascii=False, indent=2)}"
    )
    ask = _ask_claude if settings.llm_model.startswith("claude") else _ask_openai_compatible
    advice = json.loads(ask(prompt, settings))

    if not (
        isinstance(advice, dict)
        and isinstance(advice.get("summary"), str)
        and all(isinstance(advice.get(key), list) for key in ("steps", "caveats"))
        and all(isinstance(item, str) for item in advice["steps"] + advice["caveats"])
    ):
        raise ValueError("AI answer does not have summary, steps and caveats")
    return {key: advice[key] for key in ("summary", "steps", "caveats")}


def _numbers(text: str) -> set[float]:
    text = re.sub(r"(?<=\d),(?=\d{3})", "", text)  # 2,300 -> 2300
    return {float(n) for n in re.findall(r"\d+(?:\.\d+)?", text)}


def check_numbers(advice: dict[str, Any], facts: dict[str, Any]) -> bool:
    """True if every number in the advice also appears in the facts."""
    allowed = _numbers(json.dumps(facts))
    allowed |= {round(n) for n in allowed}  # 945.14 may be written as 945
    allowed |= {round(n * 100) for n in allowed if n < 1}  # 0.41 may be written as 41%
    written = _numbers(" ".join([advice["summary"], *advice["steps"], *advice["caveats"]]))
    return written <= allowed


def fallback_advice(facts: dict[str, Any]) -> dict[str, Any]:
    """Template advice (English) used when the AI is not available."""
    action, assumed = facts["action"], facts["assumptions"]
    return {
        "summary": action["reason"],
        "steps": FALLBACK_STEPS[action["issue_type"]],
        "caveats": [
            f"Revenue per session is an assumed {assumed['currency']} {assumed['rm_per_session']:.0f}",
            f"Drivers are assumed to leave after waiting {assumed['max_tolerable_wait_min']:.0f} minutes",
        ],
    }


def get_advice(
    data: DataStore, settings: Settings, action_id: str, time: datetime, language: str
) -> dict[str, Any]:
    action = next((a for a in build_action_list(data, time) if a["id"] == action_id), None)
    if action is None:
        raise not_found(f"Action {action_id} does not exist")

    key = (action_id, time.isoformat(), language)
    if key in _cache:
        return {**_cache[key], "cached": True}

    facts = build_facts(data, action, time)
    if settings.llm_configured:
        try:
            advice = generate_advice(facts, language, settings)
            if check_numbers(advice, facts):
                _cache[key] = {"action_id": action_id, **advice, "source": "llm"}
                return {**_cache[key], "cached": False}
            logger.warning("AI advice for %s used numbers that are not in the facts", action_id)
        except (anthropic.APIError, openai.OpenAIError, ValueError) as exc:
            logger.warning("AI advice for %s failed: %s", action_id, exc)

    return {"action_id": action_id, **fallback_advice(facts), "source": "template", "cached": False}
