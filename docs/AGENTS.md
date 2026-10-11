# AmpWise — context for AI coding assistants

Read this before writing any code in this repo.

> The contract is at v1.1 (`docs/api_contract.md`); its change log has the history from v0.1.
> The first draft was about Malaysia (ringgit, `+08:00`, Hari Raya). Only the field names with `rm_` and the mock-mode examples are left of it.

## What we are building

AmpWise is an operator dashboard for EV charging networks (hackathon, Track 1: Predictive Model).
It forecasts queues at each charging station, detects failing chargers, and turns both into a ranked action list
with a money value and a plain-language reason. Core idea: a broken charger only becomes expensive when demand is high
(here, the weekday morning rush).

The data is the ACN dataset: four workplace garages in California (Caltech and JPL), 30 Nov 2019 to 29 Feb 2020,
station local time (`-08:00`), USD. The demo replays that window with a time slider; it does not forecast today.

Judging rubric we must hit: Detect → Categorize → Prioritize → Explain, and "prove the model leads to better decisions".

## Source of truth

- `docs/api_contract.md` — every endpoint, field name, enum, example and env var. **Never invent fields or endpoints that are not in it.**
  If something is missing, stop and say so instead of guessing.
- If code and the contract disagree, the contract wins.

## Stack

- Backend: Python 3.12, FastAPI, Pydantic v2, pandas, pyarrow. Firebase Admin SDK (Firestore only, no Auth).
- Frontend: React + Vite + TypeScript, react-leaflet, recharts, @tanstack/react-query.
- ML: notebooks in Colab; exported models in `ml/models/exported/`; ML's exports in `ml/output/`; the converted files the backend reads in `backend/data/` (parquet, committed, written by `backend/scripts/convert_ml_outputs.py`).

## Repo layout

```
backend/app/
  api/routes/     one file per endpoint group: meta, stations, chargers, actions, whatif, backtest, reports, overview, demo, scenarios
  core/           config.py (env vars via pydantic-settings)
  schemas/        Pydantic models mirroring docs/api_contract.md section 3
  services/       data_loader, queueing, classifier, priority, explain, whatif, backtest, llm
  firebase/       Admin SDK init + Firestore helpers
  utils/          mock_data.py (returns the contract's example JSON)
backend/tests/    pytest
frontend/src/     features (one folder per page), components, services (API calls), context (TimeContext), types/api.ts
ml/src/           preprocessing + inference (used by ML only; backend does NOT import it), e.g. preprocessing/clean_feedback.py
firebase/         firestore.rules (deny all client access)
docs/             api_contract.md
```

## Hard rules

1. **Backend reads ML results from parquet in `DATA_DIR`. It never imports `ml/` code or loads model files.**
2. **The LLM only explains and suggests steps.** Ranking, money values, fault status and wait times come from our own code.
   The prompt gets a fixed facts JSON; reject AI output that contains numbers not in the facts. 8 s timeout, template fallback, cache.
3. **Secrets only in `backend/.env`** (`LLM_API_KEY`, `FIREBASE_CREDENTIALS`). Never in frontend code, never committed.
4. **Frontend never talks to Firestore.** Everything goes through the backend API.
5. `MOCK=1` must make every endpoint return the contract's example responses, so the frontend is never blocked.
6. All data endpoints take `time` (simulated "now", ISO 8601 with the station's offset, `-08:00` on the current data). Do not use the real clock for business logic.
7. Keep it simple: no ORM, no SQL database, no auth, no background workers. Data lives in memory after startup.
   The one thing that changes afterwards is which chargers an operator marked done (`DataStore.repaired`, mirrored from Firestore).

## Domain glossary

| Term | Meaning |
| --- | --- |
| slot | 30-minute time bucket |
| arrivals | cars arriving at a station in a slot (from ML 1) |
| n_working | chargers not flagged faulty, plus the faulty ones whose action an operator marked done |
| wait | M/M/c (Erlang C) expected wait from arrivals, avg charge time, n_working |
| unserved sessions | cars forecast to arrive while every working charger is busy; a served car holds its charger for the average charge time. Averaged over 500 random versions of the forecast, because real cars arrive in bunches. An estimate, not customers seen leaving |
| rm_at_risk | estimated revenue at risk, in `meta.currency` (USD; the `rm_` prefix is from the first draft): unserved sessions over the next 72 hours that fixing the issue would serve × `rm_per_session` |
| issue types | safety_fault, degraded, connector_fault, user_reported, congestion, chronic_undercapacity, underused |
| priority | safety_fault first; then every charger and station issue by rm_at_risk (ties: driver reports); underused last |
| what-if | one decision, before vs after (fix a charger now, add chargers); a run can be saved |
| backtest | one replayed week: baseline (each fault lasts until its real repair day) vs ours (repair the day it is known, in action-list order) |

## Code style

- Type hints everywhere; small pure functions in `services/`, thin route handlers.
- Pure calculation functions (queueing, priority) get pytest unit tests with known inputs and outputs.
- Errors use the contract's error format `{ "error": { "code", "message" } }`.
- When unsure about scope, prefer the smaller version that works for the demo.
