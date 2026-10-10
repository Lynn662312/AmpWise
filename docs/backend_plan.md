# AmpWise backend — staged plan and progress

Field names and endpoints follow `docs/api_contract.md`. Stages are in build order: work that unblocks a teammate comes first.

| Stage | What | Status |
| --- | --- | --- |
| 0 | Setup | Done |
| 1 | Mock API for the frontend | Done |
| 2 | Calculation core | Done |
| 3 | Action list on parquet data | Done |
| 4 | AI advice | Built, needs a real key |
| 5 | What-if and backtest | Done |
| 6 | Frontend integration (on dummy data) | Next |
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

## Stage 3 — Action list on parquet data — Done

In plain words: find the problems, put a ringgit value on each, sort them, and write one sentence explaining each.

- [x] `app/services/priority.py` — `score_issue`, `build_action_list`, `recommend_action`; `safety_fault` first, then `rm_at_risk` descending
- [x] `app/services/explain.py` — `make_reason` templates
- [x] `app/services/views.py` — builds the meta, station, forecast and charger health responses
- [x] `/api/meta`, `/api/stations`, `/api/stations/{id}/forecast`, `/api/chargers/{id}/health`, `/api/actions` use parquet data when `MOCK=0`
- [x] `tests/test_priority.py` — ordering, ids, endpoints on the dummy data, `/api/actions` under 1 s

How to test: `pytest -v` shows 38 passed. Then run `python -m scripts.make_dummy_data`, set `MOCK=0` in `backend/.env`, start the server and call `/api/actions` with the two demo times: "Normal Tuesday" gives 2 actions, "Day before Raya exodus" gives 7 with the safety fault first.

Ranking, updated to include driver reports:

1. Safety faults.
2. Charger maintenance, whether the charger's own sensors found it or drivers reported it: most driver reports first, because more reports means more people affected. Ties go to the most money at risk.
3. Station issues (congestion, capacity, underuse), most money at risk first.

A charger that drivers reported but whose sensors show no fault becomes a `user_reported` action ("Inspect charger"); it needs 2 or more reports in the last 7 days. Reports on a charger the sensors already flag raise that action's report count and are not listed twice. Each action carries `report_count` and `first_reported_at` for the frontend to show.

Reports come from `user_reports.parquet` (ML). ML has not sent the field names for sensor results, fault dates or driver reports yet, so the dummy data and the converter write placeholders; the converter is the one place to adapt when their names arrive.

What needs storing: nothing from the ML files (report times, sensor results, forecasts are read-only and served through the API). Only what people change in the app needs storing: the maintenance status of an action and when it changed. That is Stage 8 (`PATCH /api/actions/{id}/status`), in memory first and Firestore at deploy.

Assumptions to confirm with the team:

- `rm_at_risk` looks 72 hours ahead.
- Faulty charger: `p_fault` × sessions saved by getting that one charger back × `rm_per_session`.
- Station issue: sessions still lost with every charger working × `rm_per_session`; `underused` is RM 0.
- Station congestion that disappears once faulty chargers are fixed is not listed separately.
- Deadline = the first slot where cars start leaving; a safety fault's deadline is now.
- Urgency: safety fault is `critical`; otherwise `high` from RM 1,000, `medium` from RM 200, else `low`.
- `/api/meta` takes `time_range` and `assumptions` from the data; corridor name, festive periods and demo times still come from the contract example.

## Stage 4 — AI advice — Built, needs a real key to finish

In plain words: the AI rewrites our facts into advice and steps. It never decides ranking or numbers.

- [x] `app/services/llm.py` — `build_facts`, `generate_advice` (8 s timeout), `fallback_advice`, `check_numbers`, `get_advice` with a cache
- [x] `POST /api/actions/{id}/advice` — always 200; `source: "template"` when the AI fails
- [x] `scripts/prewarm_advice.py` — calls the running server for every demo time, action and language
- [x] `tests/test_llm.py` — cache, timeout fallback, invented numbers rejected, no key
- [ ] Team picks the AI provider, then put its API key and model name in `backend/.env` and try it once; the real AI call has only been tested with a stand-in and with fake keys
- [ ] Run `python -m scripts.prewarm_advice http://localhost:8000` before the demo, and again after every server restart

How to test: `pytest -v` shows 48 passed. Without a key the endpoint returns `source: "template"`, still 200. With a key it returns `source: "llm"`, and a second identical call returns `cached: true`.

Notes:

- The provider follows `LLM_MODEL`, so switching needs only the two `.env` lines: a name starting with `claude` goes to Anthropic, `gemini` to Google, anything else to OpenAI.
- A chat subscription (Claude Pro, ChatGPT Plus) does not include an API key; API access is a separate account with its own billing.
- Only AI answers are cached, so a failed call is retried next time.
- Template advice is English only, and the pre-warm script warms English only.
- The cache is in memory and is lost when the server restarts.

## Stage 5 — What-if and backtest — Done

In plain words: show that following our list beats the usual way of working.

- [x] `app/services/whatif.py` — `simulate_fix` and `simulate_add_chargers`; the discount scenario returns 400 "not available yet"
- [x] `app/services/backtest.py` — `run_baseline`, `run_ours`, `compare`
- [x] `POST /api/whatif` and `GET /api/backtest` answer from the data when `MOCK=0`
- [x] `tests/test_whatif_backtest.py`
- [ ] Give the backtest numbers to whoever makes slides (after ML's real files are in)

How to test: `pytest -v` shows 56 passed. With `MOCK=0`, fixing `stn_003_c1` at the "Day before Raya exodus" time lowers the wait and raises revenue, and `/api/backtest` shows `queue_minutes_saved` above zero.

How the backtest works (assumptions to confirm with the team):

- It replays 7 days, starting 4 days before the first festive period in the data. The `week` parameter is accepted but not used yet.
- One technician repairs one charger per day; the charger works again the next day.
- Baseline: a fault is known when the first driver reports it, and faults are fixed first come, first served.
- Ours: a fault is known the day the sensors flag it, or on its second driver report, and faults are fixed in action-list order.
- Rerouting drivers to other stations is not simulated.
- Forecast error compares the model and "same slot last week" against `arrivals_actual`.
- Precision and recall compare the chargers the health model flagged with `fault_labels.parquet`.

What-if looks 72 hours ahead; revenue is the sessions that actually charge × revenue per session.

## Stage 6 — Frontend integration (before ML, on dummy data)

- [ ] Frontend switches from `MOCK=1` to `MOCK=0` with the dummy parquet
- [ ] Check CORS from `http://localhost:5173`; walk every page together
- [ ] Fix mismatches by changing `docs/api_contract.md` first, then code

## Stage 7 — ML integration (when Colab outputs are ready)

ML trains in Colab and exports result files. The backend only reads those files, never the notebook or the model.

The data is US (ACN dataset, California): test window 2019-12-01 to 2020-02-29, US holidays, USD. The demo replays that window with the time slider; it does not forecast 2026.

How to bring ML's files in:

1. In Colab, download `model1_test_predictions.csv` and `model1_metrics.json` (Files panel on the left, right-click, Download).
2. Put both in `ml/outputs/raw/` on your machine.
3. From `backend`: `python -m scripts.convert_ml_outputs`, then `python -m scripts.check_data`.
4. Restart the server with `MOCK=0`.

- [x] `scripts/convert_ml_outputs.py` — renames ML's columns, converts UTC to California time, applies the assumed festive multiplier, and writes all the files the backend reads (tested on a made-up file in ML's format, not yet on the real one)
- [x] Decided: only `is_holiday` counts as festive; `near_holiday` is ignored
- [x] Decided: ML's wait columns are not used, so their average charge time is not needed; the backend uses its own `avg_charge_min`
- [ ] Run it on ML's real files and tune the placeholders at the top of the script: station names, coordinates, charger counts, revenue per session, average charge time
- [ ] Replace the placeholder charger faults and driver reports when ML delivers the sensor data (`health.parquet`, `fault_labels.parquet`) and the report data (`user_reports.parquet`)
- [ ] Put the files in `DATA_DIR`, replacing the dummy ones
- [x] `scripts/check_data.py` — run `python -m scripts.check_data ../ml/outputs` on ML's files; it reports missing columns, unknown station ids, slots that are not 30 minutes, timestamps not in `+08:00`, unknown status values and charger counts that do not match
- [x] `time_range`, `festive_periods`, `demo_times` and `currency` in `/api/meta` now come from the data files (`meta.json`, written by the converter)
- [ ] Check the numbers look sensible and re-run the frontend walkthrough

## Stage 8 — Deploy and optional extras

- [ ] Commit the final parquet and `params.json` into `backend/data/`; `DATA_DIR=./data` in production
- [ ] Render web service: root `backend/`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, env vars from contract section 7
- [ ] Add the deployed frontend domain to `CORS_ORIGINS`; check `/api/health` on the live URL
- [ ] Optional: `PATCH /api/actions/{id}/status`, `POST /api/demo/reset`, `/api/scenarios`, Firestore
- [ ] Run the full demo twice against the deployed backend
