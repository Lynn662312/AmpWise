# AmpWise backend — staged plan and progress

Field names and endpoints follow `docs/api_contract.md`. Stages are in build order: work that unblocks a teammate comes first.

| Stage | What | Status |
| --- | --- | --- |
| 0 | Setup | Done |
| 1 | Mock API for the frontend | Done |
| 2 | Calculation core | Done |
| 3 | Action list on parquet data | Next |
| 4 | AI advice | |
| 5 | What-if and backtest | |
| 6 | Frontend integration (on dummy data) | |
| 7 | ML integration (Colab outputs) | |
| 8 | Deploy and optional extras | |

## How to run and test (any stage)

From the `backend` folder in PowerShell:

```
.\.venv\Scripts\activate
pytest -v
uvicorn app.main:app --reload
```

Then open `http://localhost:8000/docs` and use "Try it out". Use `2026-03-26T14:00:00+08:00` wherever `time` or `start` is asked.

First time on a new machine: `py -3.12 -m venv .venv`, activate it, then `pip install -r requirements.txt`. In VS Code, run "Python: Select Interpreter" and pick `backend\.venv`, otherwise the editor reports `Import "fastapi" could not be resolved`.

## Stage 0 — Setup — Done

In plain words: install the tools and agree on the settings.

- [x] Virtual environment in `backend/.venv` (Python 3.12) and `requirements.txt`
- [x] `backend/.env.example` and `backend/.env` use the contract's variable names; `MOCK=1`
- [ ] Team decisions that change the numbers: corridor, `rm_per_session`, `max_tolerable_wait_min`, which LLM provider

## Stage 1 — Mock API for the frontend — Done

In plain words: the server answers every required endpoint with fixed example data, so the frontend can build pages before any real logic exists.

- [x] `app/core/config.py` — reads the env vars
- [x] `app/schemas/` — the shape of every response, copied from contract sections 2–3
- [x] `app/utils/mock_data.py` — the example responses
- [x] `app/api/routes/` — `meta`, `stations`, `chargers`, `actions`, `whatif`, `backtest`
- [x] `app/main.py` — app, CORS, routers under `/api`
- [x] `app/core/errors.py` — every error is `{ "error": { "code", "message" } }`
- [x] `app/api/deps.py` — checks `time` is valid and inside `meta.time_range`
- [x] `tests/test_mock_api.py` — 14 tests
- [ ] Tell the frontend the base URL and that `/docs` is live

How to test: `pytest -v` shows 14 passed; each endpoint in `/docs` returns the example from the contract.

Known limits: `MOCK=0` returns a 500 until Stage 3. The backtest mock numbers are invented because the contract has no example.

## Stage 2 — Calculation core — Done

In plain words: the maths that turns "cars arriving" into "minutes of waiting", plus fake data files in the same format ML will deliver.

- [x] `app/services/queueing.py` — `erlang_c`, `predict_wait`, `lost_sessions`; handle zero working chargers and demand above capacity
- [x] `tests/test_queueing.py` — known inputs give known waits
- [x] `scripts/make_dummy_data.py` — writes `stations.parquet`, `forecasts.parquet`, `health.parquet`, `fault_labels.parquet`, `params.json` with the columns in contract section 5
- [x] `app/services/data_loader.py` — loads those files once at startup (only when `MOCK=0`)
- [x] `app/services/classifier.py` — `classify_station`, `classify_charger`, `working_chargers`
- [x] `tests/test_data_and_classifier.py`

How to test: `pytest -v` shows 28 passed. `python -m scripts.make_dummy_data` writes the dummy files to `ml/outputs/` (git-ignored).

Assumptions to confirm with the team:

- When demand is at or above capacity the wait is reported as 120 minutes (the formula gives infinity).
- Lost sessions = arrivals × (1 − tolerable wait ÷ actual wait) once the wait passes the limit.
- A station is `congestion` if the next 24 hours peak above 40 minutes, `chronic_undercapacity` if that happens even on normal demand with every charger working, and `underused` if it is under 10% busy.
- Any charger that is not `healthy` counts as not working.
- `evidence` in `health.parquet` is a list of strings per row.

## Stage 3 — Action list on parquet data

In plain words: find the problems, put a ringgit value on each, sort them, and write one sentence explaining each.

- [ ] `app/services/priority.py` — `score_issue`, `build_action_list`, `recommend_action`; `safety_fault` first, then `rm_at_risk` descending
- [ ] `app/services/explain.py` — `make_reason` templates
- [ ] `/api/meta`, `/api/stations`, `/api/stations/{id}/forecast`, `/api/chargers/{id}/health`, `/api/actions` use parquet data when `MOCK=0`
- [ ] Tests for ordering; `/api/actions` responds in under 1 s

How to test: set `MOCK=0`; the "Day before Raya exodus" time shows more and costlier actions than "Normal Tuesday".

## Stage 4 — AI advice

In plain words: the AI rewrites our facts into advice and steps. It never decides ranking or numbers.

- [ ] `app/services/llm.py` — `build_facts`, `generate_advice` (8 s timeout), `fallback_advice`, `check_numbers`, `get_advice` with a cache
- [ ] `POST /api/actions/{id}/advice` — always 200; `source: "template"` when the AI fails
- [ ] Pre-warm script for `meta.demo_times` in `en`, `zh`, `ms`

How to test: with a key, `source` is `"llm"`; remove `LLM_API_KEY` and it is `"template"`, still 200.

## Stage 5 — What-if and backtest

In plain words: show that following our list beats the usual way of working.

- [ ] `app/services/whatif.py` — `simulate_fix` (required); add chargers and discount if time allows
- [ ] `app/services/backtest.py` — `run_baseline`, `run_ours`, `compare`
- [ ] Wire `POST /api/whatif` and `GET /api/backtest`; give the numbers to whoever makes slides

How to test: fixing a broken charger must lower the wait and raise revenue; "ours" must not be worse than baseline.

## Stage 6 — Frontend integration (before ML, on dummy data)

- [ ] Frontend switches from `MOCK=1` to `MOCK=0` with the dummy parquet
- [ ] Check CORS from `http://localhost:5173`; walk every page together
- [ ] Fix mismatches by changing `docs/api_contract.md` first, then code

## Stage 7 — ML integration (when Colab outputs are ready)

ML trains in Colab and exports result files. The backend only reads those files, never the notebook or the model.

- [ ] Agree with ML that Colab's last cell writes exactly the contract section 5 files; give them `make_dummy_data.py` as the format reference
- [ ] Put the files in `DATA_DIR`, replacing the dummy ones
- [ ] Startup validation: missing column, wrong type, slots not 30 minutes, timestamps without `+08:00`
- [ ] Update `time_range`, `festive_periods`, `demo_times` in `/api/meta` to the real date range
- [ ] Check the numbers look sensible and re-run the frontend walkthrough

## Stage 8 — Deploy and optional extras

- [ ] Commit the final parquet and `params.json` into `backend/data/`; `DATA_DIR=./data` in production
- [ ] Render web service: root `backend/`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, env vars from contract section 7
- [ ] Add the deployed frontend domain to `CORS_ORIGINS`; check `/api/health` on the live URL
- [ ] Optional: `PATCH /api/actions/{id}/status`, `POST /api/demo/reset`, `/api/scenarios`, Firestore
- [ ] Run the full demo twice against the deployed backend
