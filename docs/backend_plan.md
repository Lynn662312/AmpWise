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
| 6 | Frontend integration (on ML's real data) | Next |
| 7 | ML integration (Colab outputs) | Done |
| 8 | Deploy, Firestore and optional extras | After Stage 6 |

## What is left (updated 2026-10-10)

The backend side of the ML integration is finished: 68 backend tests and 1 ML test pass, and the server runs on ML's real files. What remains, in order:

1. [x] Commit this work: committed and pushed on the branch `ml-integration`. Next: open a pull request into `main`.
2. [ ] Frontend integration (Stage 6): bring the frontend branch and this branch together, switch the frontend to the live API, and close the gaps listed there.
3. [ ] Team decisions that change the numbers: revenue per session (placeholder USD 10), tolerable wait (45 minutes), demo times, the backtest week.
4. [ ] Business meeting: confirm how site issues and payment complaints are handled.
5. [ ] Ask ML for both deliveries built from the same chargers. Until then a faulty charger barely moves the queue, so money at risk and the backtest gain stay near zero.
6. [ ] AI advice: pick the provider and put a real key in `backend/.env` (Stage 4).
7. [ ] Firestore: action status and saved what-if runs (Stage 8). Firebase setup instructions still have to be written for this step.
8. [ ] Deploy backend and frontend, then run the full demo twice (Stage 8).

## How to run and test (any stage)

From the `backend` folder in PowerShell:

```
.\.venv\Scripts\activate
pytest -v
uvicorn app.main:app --reload
```

Then open `http://localhost:8000/docs` and use "Try it out". Wherever `time` or `start` is asked: with `MOCK=1` use `2026-03-26T14:00:00+08:00`; with `MOCK=0` (ML's real data) use a demo time such as `2020-02-25T07:00:00-08:00`.

If `pytest` stops with `ModuleNotFoundError: No module named 'anthropic'` (or another package), the virtual environment is not active: the prompt must start with `(.venv)`. Run `.\.venv\Scripts\activate` first, or call it directly with `.\.venv\Scripts\python.exe -m pytest -v`.

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

How to test: `pytest -v` shows 28 passed. `python -m scripts.make_dummy_data` writes the dummy files to `DATA_DIR`. That is now `backend/data/`, which holds ML's real converted files, so only run it if you want the dummy data back; `git restore backend/data` undoes it.

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

How to test: `pytest -v` shows 38 passed. Then run `python -m scripts.make_dummy_data`, set `MOCK=0` in `backend/.env`, start the server and call `/api/actions` with the two demo times: "Normal Tuesday" gives 2 actions, "Day before Raya exodus" gives 10 with the safety fault first and the site issue last. (These two times are for the dummy data.)

Ranking, updated to include driver reports:

1. Safety faults.
2. Charger maintenance, whether the charger's own sensors found it or drivers reported it: most driver reports first, because more reports means more people affected. Ties go to the most money at risk.
3. Station issues (congestion, capacity, underuse), most money at risk first.
4. Site issues (a blocked or dirty bay), most driver reports first.

A charger that drivers reported but whose sensors show no fault becomes a `user_reported` action ("Inspect charger"); it needs 2 or more reports in the last 7 days. Reports on a charger the sensors already flag raise that action's report count and are not listed twice. Each action carries `report_count` and `first_reported_at` for the frontend to show.

A `site_issue` action ("Needs human action") is for reports a technician cannot fix: 2 or more reports in the last 7 days that the bay is blocked or dirty. It has no money value and no deadline, and it is counted separately from the charger reports above. When an AI key is added, `POST /api/actions/{id}/advice` gives recommendations for it like for any other action.

Reports come from `user_reports.parquet`, which the converter writes from ML's cleaned feedback, `feedback_clean.csv` (Stage 7 has the rule). The converter is the one place where ML's names and categories are turned into ours.

What needs storing: see the table in Stage 8. In short, nothing from the ML files; only what people change in the app.

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

How the backtest works (reworked for ML's real faults; assumptions to confirm with the team):

- It replays 7 days, starting the day before the first real fault in the data. The `week` parameter is accepted but not used yet.
- Baseline is what really happened: each charger is down from the day its fault starts to the day it was really repaired (`end_date` in `fault_labels.parquet`, ML's `end`).
- Ours: a fault is known the day the sensors flag it, or on its second driver report during the fault. One technician repairs one known fault per day, in action-list order, and the charger works again the next day.
- A fault we never notice still ends on its real repair day, so ours is never worse than the baseline.
- Every real fault counts as "charger down", including the ones only drivers can see (damaged cable, blocked bay).
- A file without `end_date` (the dummy data has one, three days after each fault starts) is treated as "not repaired within the week".
- Rerouting drivers to other stations is not simulated.
- Forecast error compares the model and "same slot last week" against `arrivals_actual`.
- Precision and recall compare the chargers the sensors flagged with the chargers in `fault_labels.parquet`.

What-if looks 72 hours ahead; revenue is the sessions that actually charge × revenue per session.

## Stage 6 — Frontend integration (on ML's real data) — Next

In plain words: the frontend stops reading its own sample files and asks the backend instead.

The frontend is on the branch `gy-fe-branch`. It already has a switch: `VITE_DATA_MODE=mock` reads the JSON files in `frontend/src/data/`, `VITE_DATA_MODE=api` calls the backend. Its action list already expects `report_count` and `first_reported_at`.

Steps:

- [ ] Commit and push this branch, then bring it and `gy-fe-branch` together (merge both into `main`, or merge one into the other). The frontend folder on this branch is empty, so the merge should not conflict there
- [ ] Backend: `MOCK=0` in `backend/.env`, then `uvicorn app.main:app --reload`
- [ ] Frontend: in `frontend/.env` set `VITE_API_BASE_URL=http://localhost:8000/api` and `VITE_DATA_MODE=api`, then `npm install` and `npm run dev`
- [ ] Check CORS from `http://localhost:5173`; walk every page together
- [ ] Fix mismatches by changing `docs/api_contract.md` first, then code

Gaps found by reading `gy-fe-branch` (as last fetched on 2026-10-10), to close during the walkthrough:

- [ ] Frontend: add `site_issue` to its `IssueType` and to `issueConfig.ts` (label "Needs human action"). Without it, a site issue in the action list has no badge and can break the page
- [ ] Frontend: the pie chart (`FeedbackPieCard`) still reads the local `feedback.json` with satisfaction levels. Point it at `GET /api/reports/categories`, which returns the same shape (`category`, `percentage`, plus `count`)
- [ ] Decide together: in API mode the frontend has no list of chargers for a station (its charger pickers are empty), because the contract has no such endpoint. The what-if "fix now" scenario and the charger page need a charger id. Either add `GET /api/stations/{id}/chargers` to the contract, or pick chargers from the action list only
- [ ] Decide together: the dashboard cards (energy delivered, live sessions, network uptime) have no endpoint in the contract. Either drop them in API mode or agree on what they should show
- [ ] `PATCH /api/actions/{id}/status` is not built (Stage 8), so keep `VITE_ACTION_STATUS_ENABLED=false`
- [ ] Use the real demo times from `/api/meta` (2020-02-23 and 2020-02-25, 07:00); the frontend's sample files use other dates

## Stage 7 — ML integration — Done

ML trains in Colab and exports result files. The backend only reads those files, never the notebook or the model.

The data is US (ACN dataset, California): test window 2019-12-01 to 2020-02-29, US holidays, USD. The demo replays that window with the time slider; it does not forecast 2026.

How to bring ML's files in:

1. ML pushes its files to `ml/output/` on `main`: the forecast files (`model1_test_predictions.csv`, `station_profile.csv`) and the `acn_synth/` folder (chargers, sensor log, real faults, driver feedback). Merge `main` into your branch to get them.
2. `acn_synth/ocpp_events.csv` (39 MB) is not in git. Whoever runs the converter needs it from the ML team; nobody else does.
3. Clean the driver feedback (only when `feedback.csv` changed). From the repo root: `pip install -r ml/requirements.txt` once, then `python ml/src/preprocessing/clean_feedback.py`. It writes `ml/output/acn_synth/feedback_clean.csv`; commit that file.
4. From `backend`: `python -m scripts.convert_ml_outputs`, then `python -m scripts.check_data`.
5. Commit the changed files in `backend/data/`. Teammates and the deployed server then get the data with a normal `git pull`.
6. Restart the server with `MOCK=0`.

Folders: `ml/output/` is ML's (in git). `backend/data/` is what the backend reads (`DATA_DIR=./data`): eight small files, about 125 KB, written by the converter and committed. The old `ml/outputs/` folder is no longer used and can be deleted. If your own `backend/.env` still says `DATA_DIR=../ml/outputs`, change it to `./data`.

Status: the backend runs on ML's real files: 4 stations, 30 Nov 2019 to 29 Feb 2020, 23 chargers with sensors, 33 real faults, 176 charger reports and 63 site reports. `check_data` passes and `/api/actions` answers in about 0.15 s.

What `acn_synth` is: a simulated sensor log plus the list of real faults (the answer key). It is not the output of a second model, so there is no predicted status or probability to read. The converter works the status out from the charger's own messages. The field-by-field mapping is in `docs/api_contract.md` section 5.

Decided (2026-10-10):

- Sensor status comes from the charger's own `Faulted` messages in `ocpp_events.csv`. `p_fault` is 1 while the charger says it is faulted, else 0. ML's answer columns are never read.
- Charger counts stay the forecast model's (54, 24, 4, 52) for the queue maths. The 23 chargers in `acn_synth` (6, 5, 2, 10) are the ones with sensors. North Wilson's 3 chargers are left out because it has no forecast.
- A driver comment counts as a report when the ML cleaning step marks it `keep`: the comment itself reads as negative, and it is not spam. Charger categories (`Won't start`, `Slow charging`, `Cable stuck`, `Connector damaged`, `Screen broken`, and what is left of `Other`) feed `user_reported`. `Blocked by non-EV` and `Cleanliness` feed `site_issue`. `Payment issue` is left out of the action list.
- Sentiment comes from the comment text, not from the star rating, because 139 comments are worded as complaints but carry 4 or 5 stars. `ml/src/preprocessing/clean_feedback.py` trains a small text model on the comments (the ratings are only the teaching examples), so two comments with the same wording always get the same sentiment. Checked against the wording of every comment, it gets all 1,659 right; a ready-made sentiment tool (VADER) got about 89%. Spam is a comment with fewer than 3 different words (`test`, `aaaaaa`, `.`): 31 rows, the same 31 ML marked. Noise rows are dropped one by one; the `Other` category is not dropped as a whole.
- To look at the cleaned data, open `ml/output/acn_synth/feedback_clean.csv`: every original row, plus `sentiment`, `is_spam` and `keep` right after the comment. Of 1,690 rows, 1,347 are kept, 312 are positive and 31 are spam.
- Cost of this rule, measured against ML's answer key: more real faults get 2 or more reports (18 of 33, against 12 with the earlier rating rule), but more flags are false (72% are backed by a real fault, against 92%), and about twice as many chargers show as "Inspect charger".
- One row in `feedback.csv` is one report, with its own unique id, so reports are counted as they are. Repeats are not removed: dropping repeats within 10 minutes removed as many real reports from different drivers as true duplicates.
- `end` in `fault_ground_truth.csv` is when the fault was really repaired. The backtest uses it as the baseline (Stage 5).
- Pie chart of feedback categories: `GET /api/reports/categories` returns the count and percentage per category. The converter counts it once over all the `keep` rows (every charger, every date). Result: Blocked by non-EV 23.3%, Other 20.0%, Slow charging 19.5%, Won't start 14.8%, Cleanliness 7.9%, Payment issue 5.3%, Connector damaged 3.5%, Cable stuck 3.0%, Screen broken 2.7% (1,347 complaints).
- Holidays are no longer a focus. The converter uses ML's predictions as they are (no festive multiplier), and the demo times are "Quiet Sunday" (2020-02-23 07:00) and "Weekday morning rush" (2020-02-25 07:00, the busiest day in the data). Both have charger actions and site issues to show.

Where ML files go: everything from ML goes in `ml/output/`, next to the existing files, and is committed. Notebooks go in `ml/notebooks/colab/`, saved models in `ml/model/`. Never put ML's files in `backend/data/`; that folder is generated.

What the real data shows:

- Holidays are quiet. These are workplace garages, so demand peaks on weekday mornings around 7am and drops on holidays.
- Capacity differs a lot: two garages have 54 and 24 chargers and almost never queue; South Wilson has 4; JPL has 52 but 222-minute sessions, so the model shows it over capacity at the morning peak.
- Money at risk for charger faults is close to zero. The two ML deliveries are on different scales (`acn_synth` is a 20% sample of the chargers), so one faulty charger among 54 barely moves the queue. Revenue per session is also still the placeholder USD 10.
- Over the 89 days checked at 7am, the list showed a sensor fault on 40 charger-days, a driver-reported charger on 162 and a site issue on 44.

Known limits:

- Health is per day. A charger counts as faulty for the whole of every California day its fault touches, so at 7am the list can already show a fault that starts later that day.
- After a sensor fault clears, the driver reports made during it still count for 7 days, so the charger can stay on the list as "Inspect charger" for a few days.
- Power does not drop before a fault in this data (it follows how the cars charge), so the charger chart does not show a decline, and the reason for a `degraded` charger quotes the charger's own message instead of a power percentage.
- The sentiment model only knows the wording in this data set. A comment in completely new words can be read wrongly, so it has to be re-run (and re-checked) when ML sends new feedback.
- The backtest gain is small on this data: 14.6 queue minutes saved in its week (10 to 16 Dec 2019) and USD 0 protected. Over the whole three months it is 750 of about 199,000 queue minutes; the best week (from 3 Feb 2020) saves 435. The reason is the charger-count mismatch above, plus most faults being repaired within a day or two anyway. Of the 33 real faults we know 25 on the day they start and never notice 2.
- Backtest precision is 1.0 because the status comes from the charger's own fault message; recall is 0.8 because the sensors cannot see the faults only drivers report.

Done:

- [x] `scripts/convert_ml_outputs.py` — reads ML's files with ML's own column names, converts UTC to California time, takes charger count, power and charge time per station from `station_profile.csv`, and writes all the files the backend reads
- [x] Sensor results, real faults and driver reports now come from `acn_synth/`; the placeholders are gone
- [x] Station coordinates come from `acn_synth/stations.csv` (the average of each station's chargers)
- [x] New issue type `site_issue`, ranked last (contract v0.5)
- [x] `scripts/check_data.py` — reports missing columns, unknown station or charger ids, slots that are not 30 minutes, unknown status values, and more sensor chargers than the station has
- [x] Each station uses its own average charge time (`avg_charge_min` in `stations.parquet`)
- [x] `time_range`, `festive_periods`, `demo_times` and `currency` in `/api/meta` come from the data files (`meta.json`, written by the converter)
- [x] Converted files written to `backend/data/`; the `DATA_DIR` default and `.env.example` point there
- [x] Backtest reworked: baseline is the real repair day, several faults per charger
- [x] Pie chart data: `GET /api/reports/categories`, written by the converter to `report_categories.json`
- [x] Feedback cleaning on the ML side: sentiment from the comment text and spam removal (`ml/src/preprocessing/clean_feedback.py`, test in `ml/tests/`)

Still open after Stage 7 (also in "What is left" at the top):

- [x] Commit `backend/data/`, `ml/output/acn_synth/feedback_clean.csv`, `ml/src/`, `ml/tests/` and `ml/requirements.txt` (on the branch `ml-integration`)
- [ ] Lynn: review the cleaned feedback in `ml/output/acn_synth/feedback_clean.csv`. The cleaning is in `ml/src/preprocessing/clean_feedback.py`; which categories reach the action list is `REPORT_CATEGORIES` at the top of the converter
- [ ] Decide: do the remaining `Other` complaints count as charger reports in the action list (as now), or only in the pie chart
- [ ] Business meeting: confirm how site issues and payment complaints are handled (now: site issues are last in the action list, payment complaints appear only in the pie chart)
- [ ] Team: the backtest week. It starts the day before the first real fault; a week with more faults (for example from 3 Feb 2020) shows a larger gain
- [ ] Ask ML: both deliveries built from the same chargers, so a faulty charger has a visible effect on the queue
- [ ] Tune the placeholders at the top of the converter: station display names, revenue per session, tolerable wait, demo times

## Stage 8 — Deploy, Firestore and optional extras

- [x] Commit the converted files in `backend/data/` (written in Stage 7; `DATA_DIR=./data` is already the default)
- [ ] Render web service: root `backend/`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, env vars from contract section 7
- [ ] Add the deployed frontend domain to `CORS_ORIGINS`; check `/api/health` on the live URL
- [ ] Firebase setup instructions: create the project, turn on Firestore, download the service account key, set `FIREBASE_CREDENTIALS` (to write when this step starts)
- [ ] `app/firebase/` and `PATCH /api/actions/{id}/status`, `POST /api/demo/reset`, `/api/scenarios` on Firestore
- [ ] Run the full demo twice against the deployed backend

What is stored where. The frontend only ever calls the backend API, on a teammate's machine and when deployed:

| What the frontend shows | Where it comes from | Database? |
| --- | --- | --- |
| Stations, forecasts, charger health, action list, driver report counts, pie chart percentages | The files in `backend/data/`, loaded into memory when the server starts | No. They are read-only, the same for everyone, and deployed with the code |
| A what-if simulation result | Calculated on request from the same files | No |
| Saved what-if runs (`/api/scenarios`) | Someone clicking "save" | Yes: Firestore `scenarios` (to build) |
| Action status: open, assigned, done | Someone clicking in the app | Yes: Firestore `actions_status` (to build) |
| AI advice | The AI provider, cached | Optional: Firestore `advice_cache`, so it survives restarts |

Firestore is needed for the "Yes" rows because free hosting puts the server to sleep and its memory is lost. Until it is built, those two features are not available; everything else already works without a database.
