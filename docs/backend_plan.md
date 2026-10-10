# AmpWise backend — staged plan and progress

Field names and endpoints follow `docs/api_contract.md`. Stages are in build order: work that unblocks a teammate comes first.

| Stage | What | Status |
| --- | --- | --- |
| 0 | Setup | Done |
| 1 | Mock API for the frontend | Done |
| 2 | Calculation core | Done |
| 3 | Action list on parquet data | Done |
| 4 | AI advice | Built; optional, the app works without a key |
| 5 | What-if and backtest | Done |
| 6 | Frontend integration (on ML's real data) | Done and live; walkthrough by a person still to do |
| 7 | ML integration (Colab outputs) | Done |
| 8 | Deploy, Firestore and optional extras | Done for the demo: backend on Render, frontend on Vercel, action status on Firestore. Optional extras open |

## What is left (updated 2026-10-11, 4am, after contract v0.9)

Live: the website is at `https://ampwise.vercel.app` and the API at `https://portpulse-ampwise-api.onrender.com/api`. Both deploy from the branch `main`, which has contract v0.7 and the action states saved in Firestore.

Not live yet, all on the branch `final`:

- Committed and pushed (commit "update"): contract v0.8, with the charger log, the "why" cards on the charger and station pages, and what-if waits that move.
- Not committed: contract v0.9. Money now follows charger occupancy (a car is unserved only when every charger is busy), the what-if page charts the money at risk and hides the waiting-time parts when the wait does not change, station issues with no session at risk are no longer listed, the README was checked, and both `.env.example` files are references.

On all of it: 93 backend tests and 1 ML test pass, the frontend type-checks and builds, and every endpoint was called on the real data.

Before the 9am submission, in order:

1. [ ] Commit the uncommitted work on `final` and push it.
2. [ ] Open a pull request from `final` into `main` and merge it. Render and Vercel redeploy by themselves in a few minutes.
3. [ ] Open the live site and walk every page once by hand: overview, map, a station, a charger (look for "Why this charger is flagged"), actions, what-if (run one repair at JPL), results. The first call after a quiet period is slow, because the free server sleeps.
4. [ ] Give the group the new backtest numbers (Stage 7, "Known limits"): the money figure changed with v0.9.

After that, only if there is time:

- The action table and drawer still show a generic line per issue type, not the backend's `reason` sentence (the charger and station pages show it).
- Make a charger action marked done count as working again, as the contract says. Today "done" is saved and shown, but the station's numbers do not change.
- Saved what-if runs (`/api/scenarios`) and demo reset (`POST /api/demo/reset`) on Firestore, with the frontend buttons.
- The three overview buttons that do nothing ("Schedule report", "View all", "Last 7 days").
- AI advice with a real key (Stage 4). Without it the advice uses templates.
- Waiting times still look at each half hour on its own, so the wait at the morning rush is overstated; a station can show a long wait and no unserved sessions.
- Tidy the docs: the examples in `docs/api_contract.md` and the introduction of `docs/AGENTS.md` still describe the first Malaysian draft; `frontend/api-contract.txt` is an outdated copy.

Settled: ML integration; revenue per session USD 10; demo times and backtest week picked from the data by rule; site issues removed; money from charger occupancy; cleaned feedback reviewed; "same chargers" checked and not needed (Stage 7); contract v0.7 merged and deployed; assign / mark done working on the live site; local `backend/.env` fixed.

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
- [x] Team decisions that change the numbers: `rm_per_session` is USD 10; no AI provider is chosen, which is fine because the app works without one (the corridor is ACN California; the tolerable wait is gone since v0.6)

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
- [x] Tell the frontend the base URL and that `/docs` is live

How to test: `pytest -v` shows 14 passed; each endpoint in `/docs` returns the example from the contract.

Known limits: `MOCK=0` returns a 500 until Stage 3. The backtest mock numbers are invented because the contract has no example.

## Stage 2 — Calculation core — Done

In plain words: the maths that turns "cars arriving" into "minutes of waiting", plus fake data files in the same format ML will deliver.

- [x] `app/services/queueing.py` — `erlang_c`, `predict_wait` for the queue; `served_by_occupancy` for money (v0.9: a car is served when a charger is free, and then holds it for the charge time)
- [x] `tests/test_queueing.py` — known inputs give known waits
- [x] `scripts/make_dummy_data.py` — writes `stations.parquet`, `forecasts.parquet`, `health.parquet`, `fault_labels.parquet`, `params.json` with the columns in contract section 5
- [x] `app/services/data_loader.py` — loads those files once at startup (only when `MOCK=0`)
- [x] `app/services/classifier.py` — `classify_station`, `classify_charger`, `working_chargers`
- [x] `tests/test_data_and_classifier.py`

How to test: `pytest -v` shows 28 passed. `python -m scripts.make_dummy_data` writes the dummy files to `DATA_DIR`. That is now `backend/data/`, which holds ML's real converted files, so only run it if you want the dummy data back; `git restore backend/data` undoes it.

Assumptions to confirm with the team:

- When demand is at or above capacity the wait is reported as 120 minutes (the formula gives infinity).
- A session is unserved when the car is forecast to arrive while every working charger is busy (v0.9). A served car holds its charger for the station's average charge time, counted from the start of its half hour. Nothing is inferred from the waiting time.
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

How to test: `pytest -v` shows 38 passed. Then run `python -m scripts.make_dummy_data`, set `MOCK=0` in `backend/.env`, start the server and call `/api/actions` with the two demo times: "Normal Tuesday" gives 2 actions, "Day before Raya exodus" gives 9 with the safety fault first and the underused station last. (These two times are for the dummy data.)

Ranking (v0.6). Money at risk is the main business priority:

1. Safety faults, always first.
2. Every other charger and station issue that can cost revenue (sensor faults, driver-reported chargers, congestion, capacity), in one list: most money at risk first. Ties go to the most driver reports.
3. Underused stations, which never have money at risk.

So a charger with few reports but real money at risk ranks above a charger with many reports and none.

A charger that drivers reported but whose sensors show no fault becomes a `user_reported` action ("Inspect charger"); it needs 2 or more reports in the last 7 days. Reports on a charger the sensors already flag raise that action's report count and are not listed twice. Each action carries `report_count` and `first_reported_at` for the frontend to show.

Site issues were removed in v0.6. Complaints about a blocked or dirty bay no longer create an action; they are only counted in the pie chart.

How money at risk is calculated (v0.9), walking through the forecast slot by slot over the next 72 hours:

- Busy chargers = the sessions that started within the last charge time and are still charging. Served = the smaller of the arrivals and the free chargers. Unserved = the rest.
- Charger flagged by its sensors: `p_fault` × (unserved now − unserved with one more charger working) × `rm_per_session`.
- Driver-reported charger with healthy sensors: (unserved with one charger fewer − unserved now) × `rm_per_session`.
- Congestion or chronic undercapacity: unserved with every installed charger working × `rm_per_session`. If that is zero the station is not listed: a queue in which every car is still served costs no session. It still shows on the map.
- Underused: 0.

These are estimated unserved sessions, not customers seen leaving. The reason sentence says "an estimated N sessions are at risk".

Reports come from `user_reports.parquet`, which the converter writes from ML's cleaned feedback, `feedback_clean.csv` (Stage 7 has the rule). The converter is the one place where ML's names and categories are turned into ours.

What needs storing: see the table in Stage 8. In short, nothing from the ML files; only what people change in the app.

Assumptions to confirm with the team:

- `rm_at_risk` looks 72 hours ahead.
- A broken charger costs nothing while the other chargers are never all busy; it costs one session each time a car arrives and would have found only that charger free.
- A congestion or capacity issue is listed only when sessions are at risk with every charger working. That also leaves out congestion that disappears once the faulty chargers are fixed.
- Deadline = the first slot in which a car is forecast to find every charger busy; a safety fault's deadline is now. No deadline when that never happens.
- Urgency: safety fault is `critical`; otherwise `high` from RM 1,000, `medium` from RM 200, else `low`.
- `/api/meta` takes `time_range`, `assumptions` and `backtest_weeks` from the data, and the name, currency, holidays and demo times from `meta.json`, which the converter writes.

## Stage 4 — AI advice — Built; optional, the app works without a key

In plain words: the AI rewrites our facts into advice and steps. It never decides ranking or numbers.

- [x] `app/services/llm.py` — `build_facts`, `generate_advice` (8 s timeout), `fallback_advice`, `check_numbers`, `get_advice` with a cache
- [x] `POST /api/actions/{id}/advice` — always 200; `source: "template"` when the AI fails
- [x] `scripts/prewarm_advice.py` — calls the running server for every demo time, action and language
- [x] `tests/test_llm.py` — cache, timeout fallback, invented numbers rejected, no key
- [ ] Optional: pick an AI provider, put its API key and model name in `backend/.env` (and in Render) and try it once. The real AI call has only been tested with a stand-in and with fake keys. Without a key the advice comes from the templates, which is how the live site runs now
- [ ] Only with a key: run `python -m scripts.prewarm_advice http://localhost:8000` before the demo, and again after every server restart

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
- [x] Give the backtest numbers to whoever makes slides: handed over on 2026-10-11 (week of 3 to 9 Feb 2020; the numbers are under "Known limits" in Stage 7)

How to test: `pytest -v` shows 56 passed. With `MOCK=0`, fixing `stn_003_c1` at the "Day before Raya exodus" time lowers the wait and raises revenue, and `/api/backtest` shows `queue_minutes_saved` above zero.

How the backtest works (reworked for ML's real faults; assumptions to confirm with the team):

- It replays one week. Without a choice that is the 7 days with the most chargers out of service, because that week has the most to test (the earliest such week on a tie): 3 to 9 Feb 2020 on the real data. `week` picks another one from `meta.backtest_weeks`: the default first, then every Monday-to-Sunday week inside the data (12 in all). An unknown `week` gives a 400.
- Baseline is what really happened: each charger is down from the day its fault starts to the day it was really repaired (`end_date` in `fault_labels.parquet`, ML's `end`).
- `rm_protected` = (baseline unserved sessions − our unserved sessions) × revenue per session, with the occupancy rule from Stage 3 (v0.9). Queue minutes still come from the queueing model.
- Ours: a fault is known the day the sensors flag it, or on its second driver report on the charger during the fault. One technician repairs one known fault per day, in action-list order, and the charger works again the next day.
- A fault we never notice still ends on its real repair day, so ours is never worse than the baseline.
- Every real fault counts as "charger down", including the ones only drivers can see (damaged cable, blocked bay).
- A file without `end_date` (the dummy data has one, three days after each fault starts) is treated as "not repaired within the week".
- Rerouting drivers to other stations is not simulated.
- Forecast error compares the model and "same slot last week" against `arrivals_actual`.
- Precision and recall compare the chargers the sensors flagged with the chargers in `fault_labels.parquet`.

What-if looks 72 hours ahead. Revenue = the sessions served (occupancy rule) × revenue per session. "Fix now" compares the working chargers with one more; "add chargers" compares them with the requested number more. The wait shown next to it is the average wait per arriving car over those 72 hours (v0.8); the page hides the waiting-time cards and chart when the action does not change it.

The result also carries the money at risk before and after (`before_at_risk_rm`, `after_at_risk_rm`, v0.9), and the page charts that pair. The two revenue totals are nearly equal for most actions, because most sessions are served either way, so charting them looked like "nothing happens". Example, JPL on 4 Feb 2020: repairing charger 10 takes the money at risk from USD 35 to USD 13 and the revenue from USD 2,037 to USD 2,059; ten more chargers take the money at risk to 0.

Why the money rule was changed on 2026-10-11 (v0.6 to v0.9): the v0.6 rule gave each half hour a fixed capacity (chargers × 30 ÷ charge time). With charges of two to four hours that is wrong twice. In a morning burst it called most arriving cars unserved although the chargers were empty, and it valued one charger at only 0.13 to 0.21 sessions per half hour. On JPL it reported 44.6 unserved sessions and a repair that recovered 0.9 of them. The occupancy rule reports 3.5 unserved and a repair that recovers 2.3. The totals at risk are smaller than before, because on this data few cars are really turned away.

## Stage 6 — Frontend integration (on ML's real data) — Done; walkthrough by a person still to do

In plain words: the frontend stops reading its own sample files and asks the backend instead.

The frontend has a switch in `frontend/.env`: `VITE_DATA_MODE=mock` reads the JSON files in `frontend/src/data/`, `VITE_DATA_MODE=api` calls the backend at `VITE_API_BASE_URL`.

- [x] Backend and frontend branches merged into `main`
- [x] Backend runs with `MOCK=0` on ML's real files
- [x] Frontend runs with `VITE_DATA_MODE=api`
- [x] Mismatches fixed contract first (v0.6 and v0.7)
- [x] Pages checked against the live API on 2026-10-11: overview, station detail, what-if, results and actions were rendered in a headless browser against a local backend and their text was checked
- [x] Live site checked after the merge into `main` (2026-10-11): six pages rendered against the deployed API, text as expected
- [ ] Walk every page once in the browser as a person (clicking, running a what-if, opening an action)

Which backend the frontend talks to: `frontend/.env` points `VITE_API_BASE_URL` at the deployed backend on Render, and so does the live website on Vercel. That server runs `main`, which has contract v0.7 since the merge. To test changes that are not merged yet, set `VITE_API_BASE_URL=http://localhost:8000/api` and start the backend locally (its `CORS_ORIGINS` already allows `http://localhost:5173`).

What was hard-coded or not connected, and what was done about it (2026-10-11):

| Where | Before | Now |
| --- | --- | --- |
| Overview: energy delivered, live sessions, uptime, energy chart | The same sample numbers at every slider time | Real totals at the slider time from `GET /api/overview?time=` (ML's energy and session files). The badge reads "Backend overview data" |
| Overview: "Station performance" | "Per-station session data is not available yet" | The live station list: working chargers and the predicted wait now |
| What-if "Repair charger" picker | Empty | Filled from the new `GET /api/stations/{id}/chargers` |
| Station detail | No charger list | Lists the station's chargers with their status; each opens its health page |
| Results week selector | Weeks from a local file; every choice showed the same week | Weeks from `meta.backtest_weeks`; each choice replays that week |
| What-if "Off-peak discount" | Offered, then refused by the API | Not offered with the live API (the backend has no such scenario) |
| What-if repair "after the peak" | A disabled "Mock comparison only" button | Hidden with the live API |
| Presentation mode | Disabled with the live API | Its presets are the demo times from `/api/meta`; the guided demo follows the top charger action |
| Station area text | "Location unavailable" | Shows the station id |
| Sidebar "Settings" link | Led to no page | Removed |
| `max_tolerable_wait_min`, `site_issue` | Leftovers from contract v0.5 | Removed from the frontend's types, badge config and sample file |
| Action list order | (to check) | Already shows the API's rank by default |
| Why a charger is flagged (v0.8, not merged yet) | Nothing: no reason sentence, no evidence list, no log | The charger page shows the backend's reason, the sensor evidence, and a 14-day log: fault messages, the reading before the fault (for example cable temperature against its usual value) and the drivers' own reports |
| Why a station needs attention (v0.8, not merged yet) | Nothing | The station page lists its open actions with the reason and the money at risk for each |
| What-if "Predicted waiting time" and "Waiting time difference" (v0.8, not merged yet) | Always 120 → 120 or 0 → 0, difference 0 | The average wait, which moves when capacity changes (JPL plus 10 chargers on 4 Feb: 59.1 → 50.0 minutes). When an action does not change the wait, the two cards and the chart are not shown |
| What-if revenue chart (v0.9, not merged yet) | Two nearly equal revenue totals ("USD 145 → 150") | The money at risk before and after, which drops clearly when the action helps; no chart when nothing changes |

Still open in the frontend:

- [x] Assign / mark done is on: `VITE_ACTION_STATUS_ENABLED=true` on Vercel, and the action list and drawer show the saved state (2026-10-11)
- [ ] The action table and drawer show a generic line per issue type, not the backend's `reason` sentence (the charger and station pages show it since v0.8)
- [x] Forecast checked on the live site (2026-10-11): every station returns every half-hour slot. Three things look empty and are normal. "Baseline" is the real number of arrivals in the same slot one week earlier, so it is 0 in most slots. The wait is 0 in most slots because three of the four garages are far below capacity. And near the end of the data (29 Feb 2020, afternoon) only a few slots are left to show
- [ ] Saved what-if runs and demo reset are not wired, and the backend has no routes for them yet (Stage 8)
- [ ] Three buttons on the overview page do nothing yet: "Schedule report", "View all", "Last 7 days"
- [ ] `frontend/api-contract.txt` is an old copy of the contract (v0.4); it is marked as outdated at the top. Delete it or copy `docs/api_contract.md` again
- [ ] The overview totals are small next to the forecast, because ML's session files cover a 20% sample of the chargers

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

Status: the backend runs on ML's real files: 4 stations, 30 Nov 2019 to 29 Feb 2020, 23 chargers with sensors, 33 real faults and 176 driver reports on chargers. `check_data` passes and `/api/actions` answers in about 0.15 s.

What `acn_synth` is: a simulated sensor log plus the list of real faults (the answer key). It is not the output of a second model, so there is no predicted status or probability to read. The converter works the status out from the charger's own messages. The field-by-field mapping is in `docs/api_contract.md` section 5.

Decided (2026-10-10):

- Sensor status comes from the charger's own `Faulted` messages in `ocpp_events.csv`. `p_fault` is 1 while the charger says it is faulted, else 0. ML's answer columns are never read.
- Charger counts stay the forecast model's (54, 24, 4, 52) for the queue maths. The 23 chargers in `acn_synth` (6, 5, 2, 10) are the ones with sensors. North Wilson's 3 chargers are left out because it has no forecast.
- A driver comment counts as a report when the ML cleaning step marks it `keep` (the comment itself reads as negative, and it is not spam) and its category is about the charger: `Won't start`, `Slow charging`, `Cable stuck`, `Connector damaged`, `Screen broken`, or what is left of `Other`. Those feed `user_reported`. `Blocked by non-EV`, `Cleanliness` and `Payment issue` are left out of the action list and appear only in the pie chart (v0.6: site issues removed).
- Sentiment comes from the comment text, not from the star rating, because 139 comments are worded as complaints but carry 4 or 5 stars. `ml/src/preprocessing/clean_feedback.py` trains a small text model on the comments (the ratings are only the teaching examples), so two comments with the same wording always get the same sentiment. Checked against the wording of every comment, it gets all 1,659 right; a ready-made sentiment tool (VADER) got about 89%. Spam is a comment with fewer than 3 different words (`test`, `aaaaaa`, `.`): 31 rows, the same 31 ML marked. Noise rows are dropped one by one; the `Other` category is not dropped as a whole.
- To look at the cleaned data, open `ml/output/acn_synth/feedback_clean.csv`: every original row, plus `sentiment`, `is_spam` and `keep` right after the comment. Of 1,690 rows, 1,347 are kept, 312 are positive and 31 are spam.
- Cost of this rule, measured against ML's answer key: more real faults get 2 or more reports (18 of 33, against 12 with the earlier rating rule), but more flags are false (72% are backed by a real fault, against 92%), and about twice as many chargers show as "Inspect charger".
- One row in `feedback.csv` is one report, with its own unique id, so reports are counted as they are. Repeats are not removed: dropping repeats within 10 minutes removed as many real reports from different drivers as true duplicates.
- `end` in `fault_ground_truth.csv` is when the fault was really repaired. The backtest uses it as the baseline (Stage 5).
- Pie chart of feedback categories: `GET /api/reports/categories` returns the count and percentage per category. The converter counts it once over all the `keep` rows (every charger, every date). Result: Blocked by non-EV 23.3%, Other 20.0%, Slow charging 19.5%, Won't start 14.8%, Cleanliness 7.9%, Payment issue 5.3%, Connector damaged 3.5%, Cable stuck 3.0%, Screen broken 2.7% (1,347 complaints).
- Holidays are no longer a focus. The converter uses ML's predictions as they are (no festive multiplier).
- Demo times are picked from the data by rule, most interesting first, all at the busiest hour (07:00). The frontend opens on the first one. "Safety faults" (2020-01-10): the day with the most safety faults; two are at the top of the list, with congestion, capacity and driver-reported chargers below. "Most chargers down" (2020-02-04): three sensor faults at once, inside the backtest week. "Weekday morning rush" (2020-02-25): the busiest day. "Quiet Sunday" (2020-02-23): the contrast, every station green.
- Revenue per session is USD 10 (team decision; it was a placeholder before).

Where ML files go: everything from ML goes in `ml/output/`, next to the existing files, and is committed. Notebooks go in `ml/notebooks/colab/`, saved models in `ml/model/`. Never put ML's files in `backend/data/`; that folder is generated.

What the real data shows:

- Holidays are quiet. These are workplace garages, so demand peaks on weekday mornings around 7am and drops on holidays.
- Capacity differs a lot: two garages have 54 and 24 chargers and almost never queue; South Wilson has 4; JPL has 52 but 222-minute sessions, so the model shows it over capacity at the morning peak.
- With the occupancy rule (v0.9) a broken charger costs money only when the station fills up, which here means JPL at the weekday morning rush. Of the 40 charger-days with a sensor fault, 9 show money at risk, at most USD 23. The Caltech garages with 24 and 54 chargers are under 10% busy and never fill, so losing one charger changes nothing there. And most faults are repaired within a day or two.
- The different charger counts in ML's two deliveries (the forecast covers every charger, `acn_synth` a 20% sample) are not the cause. Checked on 2026-10-11 by scaling every station to its sensor chargers with demand scaled the same: money at risk for sensor faults over the three months is USD 171 against USD 160, and the backtest avoids 2.9 estimated unserved sessions against 2.6. So ML does not need to rebuild anything for this.
- Over the 89 days checked at 7am, the list showed a sensor fault on 40 charger-days and a driver-reported charger on 162. A station capacity or congestion issue was listed on 16 days (only when sessions are at risk, v0.9). The first item was a driver-reported charger on 59 days, a capacity or congestion issue on 13, a sensor fault on 8 and a safety fault on 6.

Known limits:

- Health is per day. A charger counts as faulty for the whole of every California day its fault touches, so at 7am the list can already show a fault that starts later that day.
- After a sensor fault clears, the driver reports made during it still count for 7 days, so the charger can stay on the list as "Inspect charger" for a few days.
- Power does not drop before a fault in this data (it follows how the cars charge), so the charger chart does not show a decline, and the reason for a `degraded` charger quotes the charger's own message instead of a power percentage.
- The sentiment model only knows the wording in this data set. A comment in completely new words can be read wrongly, so it has to be re-run (and re-checked) when ML sends new feedback.
- The occupancy rule works on half-hour steps with the station's average charge time: every car is treated as charging for that average, and a car that finds every charger busy is counted as unserved, not as waiting for the next free one.
- Waiting times still look at each half hour on its own, so the wait in a short burst is overstated (JPL reads 120 minutes at the morning rush). A station can show a long wait and no unserved sessions.
- The backtest gain is small on this data. In its week (3 to 9 Feb 2020, nine real faults) it saves 412 queue minutes and protects USD 10 (1.0 estimated unserved session). Over the whole three months it saves 549 queue minutes, and 1.0 of 18.2 estimated unserved sessions out of about 8,490 forecast. The reasons are the ones under "What the real data shows": quiet garages, and faults that are repaired within a day or two anyway. Of the 33 real faults we know 25 on the day they start and never notice 3.
- Backtest precision is 1.0 because the status comes from the charger's own fault message; recall is 0.8 because the sensors cannot see the faults only drivers report.

Done:

- [x] `scripts/convert_ml_outputs.py` — reads ML's files with ML's own column names, converts UTC to California time, takes charger count, power and charge time per station from `station_profile.csv`, and writes all the files the backend reads
- [x] Sensor results, real faults and driver reports now come from `acn_synth/`; the placeholders are gone
- [x] Station coordinates come from `acn_synth/stations.csv` (the average of each station's chargers)
- [x] v0.6: `max_tolerable_wait_min` removed everywhere; new ranking (safety, then money at risk, then underused). v0.9: money from charger occupancy (estimated unserved sessions) for `rm_at_risk`, what-if revenue and `rm_protected`
- [x] v0.6: issue type `site_issue` (added in v0.5) removed again; blocked-bay and cleanliness complaints are counted in the pie chart only
- [x] `scripts/check_data.py` — reports missing columns, unknown station or charger ids, slots that are not 30 minutes, unknown status values, and more sensor chargers than the station has
- [x] Each station uses its own average charge time (`avg_charge_min` in `stations.parquet`)
- [x] `time_range`, `festive_periods`, `demo_times` and `currency` in `/api/meta` come from the data files (`meta.json`, written by the converter)
- [x] Converted files written to `backend/data/`; the `DATA_DIR` default and `.env.example` point there
- [x] Backtest reworked: baseline is the real repair day, several faults per charger
- [x] Pie chart data: `GET /api/reports/categories`, written by the converter to `report_categories.json`
- [x] Feedback cleaning on the ML side: sentiment from the comment text and spam removal (`ml/src/preprocessing/clean_feedback.py`, test in `ml/tests/`)

Still open after Stage 7 (also in "What is left" at the top):

- [x] Commit `backend/data/`, `ml/output/acn_synth/feedback_clean.csv`, `ml/src/`, `ml/tests/` and `ml/requirements.txt` (on the branch `ml-integration`)
- [x] Lynn reviewed the cleaned feedback in `ml/output/acn_synth/feedback_clean.csv` (2026-10-11). The cleaning is in `ml/src/preprocessing/clean_feedback.py`; which categories count as a report on a charger is `CHARGER_REPORT_CATEGORIES` at the top of the converter
- [x] Decided: the remaining `Other` complaints count as charger reports. Sorting them into the named categories by code was tested and does not work (the classifier is unsure and wrong on all of them), so they stay in `Other`
- [x] Decided without a meeting: site issues are removed from the action list (v0.6); blocked-bay, cleanliness and payment complaints appear only in the pie chart
- [x] Decided: the backtest week is the seven days with the most chargers out of service (3 to 9 Feb 2020)
- [x] "Both deliveries built from the same chargers": checked instead of asked, and not needed. It would not make a faulty charger matter more (numbers under "What the real data shows")
- [x] Decided: revenue per session USD 10; demo times picked by rule. The station display names at the top of the converter are our own wording and can still be changed

## Stage 8 — Deploy, Firestore and optional extras

- [x] Commit the converted files in `backend/data/` (written in Stage 7; `DATA_DIR=./data` is already the default)
- [x] Backend on Render: `https://portpulse-ampwise-api.onrender.com`, from the branch `main` (`render.yaml` on `main`: root `backend/`, `MOCK=0`, `DATA_DIR=./data`, Python 3.12). It redeploys after every push to `main`
- [x] Frontend on Vercel: `https://ampwise.vercel.app`, from the branch `main` (`frontend/vercel.json` on `main`), built to call the Render API
- [x] `CORS_ORIGINS` on Render allows the Vercel address; `/api/health` answers on the live URL (checked 2026-10-11)
- [x] Firebase: project `ampwise-portpulse-20261011` created, Firestore rules in `firebase/firestore.rules` (no client access), `app/firebase/client.py`, and `PATCH /api/actions/{id}/status` with tests. The route is live on Render
- [x] `final` merged into `main` (pull request #6, 2026-10-11); Render and Vercel redeployed, and the live site shows contract v0.7
- [x] `FIREBASE_CREDENTIALS` is set on Render: the live site saves and reloads action states (2026-10-11). To look at it: Render dashboard → service `portpulse-ampwise-api` → Environment; the key is listed there with its value hidden. If it were missing, clicking "Assigned" on the live site would fail with "Firestore is not configured"
- [x] `VITE_ACTION_STATUS_ENABLED=true` in Vercel; assign / mark done is shown on the live site
- [ ] Optional, not built: `POST /api/demo/reset` and `/api/scenarios`. Also optional: the contract says a charger action marked done counts as working again; today "done" is saved and shown but does not change the station's numbers
- [ ] Run the full demo twice against the deployed backend

Environment variables, all checked on 2026-10-11:

| Where | Variable | State |
| --- | --- | --- |
| Render | `MOCK`, `DATA_DIR`, `CORS_ORIGINS`, `PYTHON_VERSION` | Set in `render.yaml` |
| Render | `FIREBASE_CREDENTIALS` | Set: the live site stores action states |
| Render | `LLM_API_KEY`, `LLM_MODEL` | Not set: advice uses the templates |
| Vercel | `VITE_API_BASE_URL`, `VITE_DATA_MODE=api` | Set (the live site calls the Render API) |
| Vercel | `VITE_ACTION_STATUS_ENABLED` | `true`: assign / mark done is shown on the live site |
| `backend/.env` | all six | Present, but `FIREBASE_CREDENTIALS` is spread over several lines and cannot be read. Fix it with one of the two forms in `backend/.env.example`. The two AI ones are empty on purpose |
| `frontend/.env` | all three | Present; points at the Render API. Set `VITE_ACTION_STATUS_ENABLED=true` here too to see assign / mark done locally |

What is stored where. The frontend only ever calls the backend API, on a teammate's machine and when deployed:

| What the frontend shows | Where it comes from | Database? |
| --- | --- | --- |
| Stations, forecasts, charger health, action list, driver report counts, pie chart percentages | The files in `backend/data/`, loaded into memory when the server starts | No. They are read-only, the same for everyone, and deployed with the code |
| A what-if simulation result | Calculated on request from the same files | No |
| Saved what-if runs (`/api/scenarios`) | Someone clicking "save" | Yes: Firestore `scenarios` (to build) |
| Action status: open, assigned, done | Someone clicking in the app | Yes: Firestore `actions_status` (built) |
| AI advice | The AI provider, cached | Optional: Firestore `advice_cache`, so it survives restarts |

Firestore is needed for the "Yes" rows because free hosting puts the server to sleep and its memory is lost. Action status is built; saved what-if runs are not. Everything else works without a database.
