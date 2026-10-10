# AmpWise — context for AI coding assistants

Read this before writing any code in this repo.

> **Update:** the data is now US (ACN dataset, California): station local time (`-08:00`), USD, US holidays.
> Mentions of Malaysia, `+08:00`, ringgit and Hari Raya below are from the first draft. See the v0.3 note in `docs/api_contract.md`.

## What we are building

AmpWise is an operator dashboard for EV charging networks in Malaysia (hackathon, Track 1: Predictive Model).
It forecasts queues at each charging station, detects failing chargers, and turns both into a ranked action list
with a ringgit value and a plain-language reason. Core idea: a broken charger only becomes expensive when demand is high
(e.g. the day before the Hari Raya exodus).

Judging rubric we must hit: Detect → Categorize → Prioritize → Explain, and "prove the model leads to better decisions".

## Source of truth

- `docs/api_contract.md` — every endpoint, field name, enum, example and env var. **Never invent fields or endpoints that are not in it.**
  If something is missing, stop and say so instead of guessing.
- If code and the contract disagree, the contract wins.

## Stack

- Backend: Python 3.11, FastAPI, Pydantic v2, pandas, pyarrow. Firebase Admin SDK (Firestore only, no Auth).
- Frontend: React + Vite + TypeScript, react-leaflet, recharts, @tanstack/react-query.
- ML: notebooks in Colab; exported models in `ml/models/exported/`; precomputed outputs in `ml/outputs/` (parquet, git-ignored).

## Repo layout

```
backend/app/
  api/routes/     one file per endpoint group: meta, stations, chargers, actions, whatif, backtest, scenarios, demo
  core/           config.py (env vars via pydantic-settings)
  schemas/        Pydantic models mirroring docs/api_contract.md section 3
  services/       data_loader, queueing, classifier, priority, explain, whatif, backtest, llm
  firebase/       Admin SDK init + Firestore helpers
  utils/          mock_data.py (returns the contract's example JSON)
backend/tests/    pytest
frontend/src/     pages, components, hooks, services (API calls), context (TimeContext), utils/types.ts
ml/src/           preprocessing + inference (used by ML only; backend does NOT import it)
firebase/         firestore.rules (deny all client access)
docs/             api_contract.md
```

## Hard rules

1. **Backend reads ML results from parquet in `DATA_DIR`. It never imports `ml/` code or loads model files.**
2. **The LLM only explains and suggests steps.** Ranking, RM numbers, fault status and wait times come from our own code.
   The prompt gets a fixed facts JSON; reject AI output that contains numbers not in the facts. 8 s timeout, template fallback, cache.
3. **Secrets only in `backend/.env`** (`LLM_API_KEY`, `FIREBASE_CREDENTIALS`). Never in frontend code, never committed.
4. **Frontend never talks to Firestore.** Everything goes through the backend API.
5. `MOCK=1` must make every endpoint return the contract's example responses, so the frontend is never blocked.
6. All data endpoints take `time` (simulated "now", ISO 8601, +08:00). Do not use the real clock for business logic.
7. Keep it simple: no ORM, no SQL database, no auth, no background workers. Data lives in memory after startup.

## Domain glossary

| Term | Meaning |
| --- | --- |
| slot | 30-minute time bucket |
| arrivals | cars arriving at a station in a slot (from ML 1) |
| n_working | chargers not flagged faulty and not out of service |
| wait | M/M/c (Erlang C) expected wait from arrivals, avg charge time, n_working |
| lost sessions | cars that leave because wait > `max_tolerable_wait_min` |
| rm_at_risk | lost sessions × `rm_per_session` if the issue is not fixed before the next peak |
| issue types | safety_fault, degraded, connector_fault, congestion, chronic_undercapacity, underused |
| priority | safety_fault always first; others sorted by rm_at_risk descending |
| what-if | one decision, before vs after (fix now vs later, add chargers, discount) |
| backtest | a whole simulated festive week: baseline (fix in report order, nearest station) vs ours |

## Code style

- Type hints everywhere; small pure functions in `services/`, thin route handlers.
- Pure calculation functions (queueing, priority) get pytest unit tests with known inputs and outputs.
- Errors use the contract's error format `{ "error": { "code", "message" } }`.
- When unsure about scope, prefer the smaller version that works for the demo.
