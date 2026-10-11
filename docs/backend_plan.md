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
| 8 | Deploy, Firestore and optional extras | Done for the demo: backend on Render, frontend on Vercel, action status on Firestore |
| 9 | Contract v1.0: done counts as working, demo reset, saved what-if runs, website fixes | Built and tested on the branch `sleep` (pushed); not merged, so not live |
| 10 | Contract v1.1: money at risk counts cars arriving in bunches; an action can be opened again | Built and tested on `sleep`; not committed yet |

## What is left (updated 2026-10-11, after contract v1.1)

Live: the website is at `https://ampwise.vercel.app` and the API at `https://portpulse-ampwise-api.onrender.com/api`. Both deploy from the branch `main`, which has contract v0.9 (pull request #8). Checked on 2026-10-11: every page opens on a computer and on a phone-sized screen, and the API answers with the v0.9 fields.

Not live yet, on the branch `sleep`: Stage 9 (committed and pushed, not merged) and Stage 10 (in the working folder, not committed). In short, contract v1.0 (a charger marked done works again, demo reset, saved what-if runs), the website fixes, and contract v1.1 (the money at risk is no longer 0 where sessions really are at risk).

On it: 103 backend tests and 1 ML test pass, the frontend type-checks and builds, and every page was opened and clicked through in a browser against a local backend. That backend used ML's real data, with Firestore replaced by a list in memory, so the live database was not touched.

To do, in order:

1. [x] Commit the uncommitted work on `final` and push it.
2. [x] Open a pull request from `final` into `main` and merge it (pull request #8).
3. [ ] Review the branch `sleep` (Stages 9 and 10 list the files), commit Stage 10, open a pull request into `main` and merge it. Render and Vercel redeploy by themselves in a few minutes.
4. [ ] Right after that deploy, open the live Actions page and click "Reset demo" once. The live database still holds test clicks (one action done, two assigned). From v1.0 a charger marked done counts as working, so without the reset JPL's charger 9 would count as working on the days it is faulty.
5. [ ] Open the live site and walk every page once by hand: overview, map, a station, a charger (look for "Why this charger is flagged"), actions (mark one done, then "Reset demo"), what-if (run one repair at JPL on "Most chargers down" and save it), results. The first call after a quiet period is slow, because the free server sleeps; the page now says so.
6. [ ] Give the group the new backtest numbers (Stage 7, "Known limits"): the money figure changed with v0.9.

One decision for the team: there is no login, so the routes that save something (mark done, demo reset, save a what-if run) can be called by anyone who has the API address. Stage 9 says what limits the damage and what the choices are.

After that, only if there is time:

- AI advice with a real key (Stage 4). Without it the advice uses templates.
- Waiting times still look at each half hour on its own, so the wait at the morning rush is overstated; a station can show a long wait and no unserved sessions. Changing this changes the numbers already given for the slides, so it is a team decision.
- The examples in `docs/api_contract.md` still use the first draft's Malaysian names and dates. They are what mock mode returns, so they can only change together with `backend/app/utils/mock_data.py` and its tests.
- Old hand-over notes that no code uses: `frontend/note-add.txt`, `frontend/note-add-2.txt`, `frontend/src/features/chargers/add-note.tsx` and `docs/api_contract-V2.md`. They belong to the frontend side; delete them when nobody needs them.

Settled: ML integration; revenue per session USD 10; demo times and backtest week picked from the data by rule; site issues removed; money from charger occupancy; cleaned feedback reviewed; "same chargers" checked and not needed (Stage 7); contract v0.9 merged and deployed; assign / mark done working on the live site; local `backend/.env` fixed.

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
- Congestion or chronic undercapacity: unserved with every installed charger working × `rm_per_session`. If that is under 0.1 session (v1.1) the station is not listed: a queue in which every car is still served costs no session. It still shows on the map.
- Underused: 0.

These are estimated unserved sessions, not customers seen leaving. The reason sentence says "an estimated N sessions are at risk".

Reports come from `user_reports.parquet`, which the converter writes from ML's cleaned feedback, `feedback_clean.csv` (Stage 7 has the rule). The converter is the one place where ML's names and categories are turned into ours.

What needs storing: see the table in Stage 8. In short, nothing from the ML files; only what people change in the app.

Assumptions to confirm with the team:

- `rm_at_risk` looks 72 hours ahead.
- A broken charger costs nothing while the other chargers are never all busy; it costs one session each time a car arrives and would have found only that charger free. Since v1.1 this is averaged over 500 random versions of the forecast (Stage 10), because it is the bunches of cars that fill a station.
- A congestion or capacity issue is listed only when at least 0.1 session is at risk with every charger working. That also leaves out congestion that disappears once the faulty chargers are fixed.
- Deadline = the first slot in which a car is likely to find every charger busy (0.05 expected unserved sessions or more, about 1 chance in 20); a safety fault's deadline is now. No deadline when that never happens.
- Urgency: safety fault is `critical`; otherwise `high` from 10 sessions at risk, `medium` from 1, else `low` (v1.1). The first limits were RM 1,000 and RM 200, made for the dummy data; nothing on the real data reached them, so every action read "low".
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
- The website used to give up on a request after 6 seconds, which is less than the 8 seconds the AI is allowed. It now waits 90 seconds (Stage 9), so a slow AI answer is no longer cut off.

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
| Why a charger is flagged (v0.8) | Nothing: no reason sentence, no evidence list, no log | The charger page shows the backend's reason, the sensor evidence, and a 14-day log: fault messages, the reading before the fault (for example cable temperature against its usual value) and the drivers' own reports |
| Why a station needs attention (v0.8) | Nothing | The station page lists its open actions with the reason and the money at risk for each |
| What-if "Predicted waiting time" and "Waiting time difference" (v0.8) | Always 120 → 120 or 0 → 0, difference 0 | The average wait, which moves when capacity changes (JPL plus 10 chargers on 4 Feb: 59.1 → 50.0 minutes). When an action does not change the wait, the two cards and the chart are not shown |
| What-if revenue chart (v0.9) | Two nearly equal revenue totals ("USD 145 → 150") | The money at risk before and after, which drops clearly when the action helps; no chart when nothing changes |

Still open in the frontend:

- [x] Assign / mark done is on: `VITE_ACTION_STATUS_ENABLED=true` on Vercel, and the action list and drawer show the saved state (2026-10-11)
- [x] The action table, the phone cards and the drawer show the backend's `reason` sentence (Stage 9, on `sleep`)
- [x] Forecast checked on the live site (2026-10-11): every station returns every half-hour slot. Three things look empty and are normal. "Baseline" is the real number of arrivals in the same slot one week earlier, so it is 0 in most slots. The wait is 0 in most slots because three of the four garages are far below capacity. And near the end of the data (29 Feb 2020, afternoon) only a few slots are left to show
- [x] Saved what-if runs and demo reset: routes and buttons built (Stage 9, on `sleep`)
- [x] The three overview buttons that did nothing: "View all" opens the map (the station list), "Last 7 days" is now plain text because the chart has no other range, and "Schedule report" is removed because nothing in the project schedules reports (Stage 9, on `sleep`)
- [x] `frontend/api-contract.txt` (an old v0.4 copy of the contract) is deleted; `docs/api_contract.md` is the only one (Stage 9, on `sleep`)
- [x] The overview totals are small next to the forecast, because ML's session files cover a 20% sample of the chargers. The data cannot be changed, so the page now says it: "Energy and live sessions cover the chargers with sensors, about 20% of the network" (Stage 9, on `sleep`)

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
- A broken charger costs money only when the station fills up, which here means JPL and South Wilson on weekdays. With v1.1, of the 40 charger-days with a sensor fault, 13 show money at risk, at most USD 17 (with v0.9: 9, at most USD 23). The Caltech garages with 24 and 54 chargers never fill, so losing one charger changes nothing there. And most faults are repaired within a day or two.
- The different charger counts in ML's two deliveries (the forecast covers every charger, `acn_synth` a 20% sample) are not the cause. Checked on 2026-10-11 by scaling every station to its sensor chargers with demand scaled the same: money at risk for sensor faults over the three months is USD 171 against USD 160, and the backtest avoids 2.9 estimated unserved sessions against 2.6. So ML does not need to rebuild anything for this.
- Over the 89 days checked at 7am with v1.1, the list showed a sensor fault on 40 charger-days and a driver-reported charger on 163 (66 of them with money at risk). A station capacity or congestion issue was listed on 81 days (16 with v0.9), because with cars arriving in bunches JPL and South Wilson lose sessions on most weekdays even with every charger working. The first item was a capacity or congestion issue on 70 days, a driver-reported charger on 12, a safety fault on 6 and a sensor fault on 1. The list's total at risk is USD 0 on 7 days, USD 15 on a typical day and USD 130 at most.

Known limits:

- Health is per day. A charger counts as faulty for the whole of every California day its fault touches, so at 7am the list can already show a fault that starts later that day.
- After a sensor fault clears, the driver reports made during it still count for 7 days, so the charger can stay on the list as "Inspect charger" for a few days.
- Power does not drop before a fault in this data (it follows how the cars charge), so the charger chart does not show a decline, and the reason for a `degraded` charger quotes the charger's own message instead of a power percentage.
- The sentiment model only knows the wording in this data set. A comment in completely new words can be read wrongly, so it has to be re-run (and re-checked) when ML sends new feedback.
- The occupancy rule works on half-hour steps with the station's average charge time: every car is treated as charging for that average, and a car that finds every charger busy is counted as unserved, not as waiting for the next free one.
- A car frees its charger when its charge ends. In ML's session file the cars stay plugged in about twice as long (370 to 470 minutes against 110 to 220), so a garage is fuller than the rule assumes. Using the average plugged-in time instead was tested and is worse: it says 242 of JPL's 3,978 real sessions could not have happened. A fair fix needs the share of cars still plugged in after each half hour, per station, from the converter. Tested, it roughly doubles the cost of a charger down at South Wilson (18 to 34 sessions over the three months) and leaves JPL as it is. Not built: it adds a file and a contract change for a small difference.
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
- [x] `POST /api/demo/reset`, `/api/scenarios`, and a charger action marked done counting as working again: built in Stage 9 (on `sleep`, not live until it is merged)
- [ ] Run the full demo twice against the deployed backend

Environment variables, all checked on 2026-10-11:

| Where | Variable | State |
| --- | --- | --- |
| Render | `MOCK`, `DATA_DIR`, `CORS_ORIGINS`, `PYTHON_VERSION` | Set in `render.yaml` |
| Render | `FIREBASE_CREDENTIALS` | Set: the live site stores action states |
| Render | `LLM_API_KEY`, `LLM_MODEL` | Not set: advice uses the templates |
| Vercel | `VITE_API_BASE_URL`, `VITE_DATA_MODE=api` | Set (the live site calls the Render API) |
| Vercel | `VITE_ACTION_STATUS_ENABLED` | `true`: assign / mark done is shown on the live site (and, once Stage 9 is merged, "Reset demo" and the saved what-if runs) |
| `backend/.env` | all six | Present. If `FIREBASE_CREDENTIALS` is ever spread over several lines again it cannot be read: use one of the two forms in `backend/.env.example`. The two AI ones are empty on purpose |
| `frontend/.env` | all three | Present; points at the Render API. Set `VITE_ACTION_STATUS_ENABLED=true` here too to see assign / mark done locally |

What is stored where. The frontend only ever calls the backend API, on a teammate's machine and when deployed:

| What the frontend shows | Where it comes from | Database? |
| --- | --- | --- |
| Stations, forecasts, charger health, action list, driver report counts, pie chart percentages | The files in `backend/data/`, loaded into memory when the server starts | No. They are read-only, the same for everyone, and deployed with the code |
| A what-if simulation result | Calculated on request from the same files | No |
| Saved what-if runs (`/api/scenarios`) | Someone clicking "Save this run" | Yes: Firestore `scenarios` (built, Stage 9) |
| Action status: open, assigned, done | Someone clicking in the app | Yes: Firestore `actions_status` (built) |
| AI advice | The AI provider, cached | Optional: Firestore `advice_cache`, so it survives restarts |

Firestore is needed for the "Yes" rows because free hosting puts the server to sleep and its memory is lost. Action status and saved what-if runs are built. Everything else works without a database.

## Stage 9 — Contract v1.0 and website fixes — Built on the branch `sleep`, not merged

In plain words: the three optional parts of the contract now exist, and the problems found by walking the website are fixed. Nothing here changes a number that was already given for the slides.

What was built, most important first:

- [x] The first load no longer looks broken. The free server sleeps and needs up to a minute to answer again. After 4 seconds without an answer the page shows "Waking up the server…". Requests without their own time limit (what-if, advice, mark done) waited only 6 seconds; they now wait 90.
- [x] Station page on a phone: the page was 610 px wide on a 390 px screen because the forecast row pushed its card wider. The row now scrolls inside the card.
- [x] A charger link works on its own: `/chargers/stn_001_c4` needed `?station=stn_001`, now the station is read from the charger id. The badge on that page said "working" for a faulty charger; it now shows the real status.
- [x] What-if "Repair charger" only offers chargers whose sensors report a fault, and says so when there is none. "Test repair" on the charger page is shown only for a faulty charger.
- [x] What-if: when the page was opened from a link with `?station=`, the station could not be changed (it jumped back). It can now.
- [x] A charger action marked done counts as working again, as the contract always said: the station's working chargers, waits and open issues change, and the action stays on the list as done with the value it had. Moving it back to assigned undoes it.
- [x] `POST /api/demo/reset` and the "Reset demo" button on the Actions page: every action is open again and the saved what-if runs are removed.
- [x] `POST` / `GET /api/scenarios` and the "Saved runs" card on the what-if page.
- [x] The action table, phone cards and drawer show the backend's `reason` sentence.
- [x] Overview: the three buttons that did nothing, and the note about the 20% sample (see Stage 6).
- [x] Smaller download: the logo went from 3.08 MB to 60 KB (resized to 256 px; it is shown at 36 px), and every page except the overview is loaded when first opened, so the first script went from 1,308 KB to 318 KB.
- [x] Documents: contract v1.0, `docs/AGENTS.md` describes the US data, `frontend/api-contract.txt` deleted.

Files to review:

| Part | Files |
| --- | --- |
| Done counts as working | `app/services/classifier.py` (`classify_charger`), `app/services/priority.py` (the sensor-fault branch), `app/services/whatif.py`, `app/services/views.py` (`open_issue_count`), `app/services/data_loader.py` (`repaired`), `app/api/routes/actions.py`, `app/main.py` |
| Reset and saved runs | `app/api/routes/demo.py`, `app/api/routes/scenarios.py`, `app/firebase/client.py`, `app/schemas/action.py`, `app/schemas/whatif.py` |
| Tests | `tests/test_demo_state.py` (7 tests, Firestore replaced by a dict) |
| Frontend | `src/App.tsx`, `src/services/api-client.ts`, `src/features/actions/ActionsPage.tsx` and its `components/`, `src/features/what-if/WhatIfPage.tsx`, `components/ChargerSelector.tsx`, `components/SavedRuns.tsx`, `src/features/chargers/ChargerHealthPage.tsx`, `src/features/stations/StationDetailPage.tsx` |

How to test: `pytest -v` shows 100 passed. In the browser, with the backend running locally and `VITE_ACTION_STATUS_ENABLED=true`: on "Safety faults" open action #2 (JPL, charger 8), choose "Completed", then open the JPL station page: it shows 52/52 working and charger 8 as healthy. Click "Reset demo" on the Actions page and it is 51/52 again. On "Most chargers down" open what-if for JPL: the picker offers only charger 10; run it and click "Save this run".

How "done counts as working" works:

- The backend keeps a set of repaired chargers in memory (`DataStore.repaired`). It is filled from Firestore when the server starts, and changed by mark done, by moving an action back to assigned, and by a demo reset.
- `classify_charger` answers `healthy` for a charger in that set, so everything that counts working chargers follows without further changes.
- The charger's own health page and log still show what the sensors reported.

Assumptions and limits to confirm with the team:

- An action id has no date in it (`safety_fault:stn_004:stn_004_c8`), so "done" holds for that charger and issue type at every simulated time, also on a later day when the same charger has the same kind of fault again. "Reset demo" is the way back. This was already true for the state shown in the list; from v1.0 it also changes the numbers.
- Saved runs: the name is 1 to 80 characters and at most 30 runs are kept. The name is written by the page ("Repair stn_004_c10 at JPL Arroyo Garage · 2020-02-04"), the user does not type one.
- "Reset demo" always removes the saved runs too (`clear_scenarios: true`). The route itself keeps them unless asked.
- The buttons for reset and saved runs are shown with the same switch as assign / mark done (`VITE_ACTION_STATUS_ENABLED`), because all of them need Firestore.

No login, and what that means (the first point of the review that started this stage):

- Mark done, demo reset and save a run can be called by anyone who has the API address. A real fix is a login, and the project rules exclude one (`docs/AGENTS.md`, rule 7). A password placed in the website would not help either: everything the website holds can be read by its visitors.
- What limits the damage: a state can only be `assigned` or `done`, and only on an action the API has listed; a saved run is checked field by field and the list is capped at 30; "Reset demo" puts everything back in one click.
- The choices: keep it as it is for the demo (recommended: check the Actions page before presenting and reset if needed), or set `VITE_ACTION_STATUS_ENABLED=false` on Vercel after judging, which hides the buttons. Only a login would really close the routes.

Not done, and why:

- Writing to the live database was not tested: the checks used a stand-in, so the first real "Reset demo" and "Save this run" happen after the merge (step 5 at the top). Reading from the live database with the new code was tested.
- The walkthrough "as a person" and "run the full demo twice" stay open: they are for a person on the deployed site.

## Stage 10 — Contract v1.1: money at risk, and opening an action again — Built on `sleep`, not committed

In plain words: the Actions page showed "Estimated amount at risk USD 0" at the first demo time. Part of that was real and part was a flaw in how the forecast was used. The flaw is fixed; the real part is explained below.

What was checked, and what was found:

| Checked | Finding |
| --- | --- |
| The data: `forecasts.parquet`, `stations.parquet`, ML's `acn_sessions.csv` | Correct. Two garages are small against their demand (South Wilson: 4 chargers, 5 cars a weekday; JPL: 52 chargers, 55 to 80 cars). The other two (54 and 24 chargers, 30 and 25 cars) never fill up, so a broken charger there really costs no session. |
| The first demo time (Friday 10 Jan 2020, 7am) | Its two safety faults are at a garage that never fills and at JPL on a Friday, and the 72 hours that follow are mostly a weekend. A low amount there is real. |
| The function `served_by_occupancy` (who gets a charger) | Correct for the cars it is given. |
| How the forecast is fed into it | **The flaw.** The forecast is an average (0.4 cars in a half hour) and was walked through as it is. A station with a little spare room then never fills, although real cars come in ones and twos. Replaying the cars that really arrived shows it: one charger down at South Wilson for the three months costs 18 sessions, and the forecast said 4. At JPL: 24 against 8. |
| How long a car holds its charger | A second, smaller flaw, not fixed: see "Known limits" in Stage 7. |
| The urgency limits | Made for the dummy data (RM 1,000 and RM 200). Nothing on the real data reached them, so every action that was not a safety fault read "low". |

What was built:

- [x] `expected_unserved` in `app/services/queueing.py`: the next 72 hours are replayed 500 times with whole cars arriving at random around the forecast (Poisson, which the queue model already assumes), and the unserved sessions are averaged. The seed is fixed, so the same question always gets the same answer. `outlook` in `app/services/priority.py` uses it, and so do `rm_at_risk` and the what-if money.
- [x] Under 0.1 session at risk counts as nothing (`MIN_SESSIONS_AT_RISK` in `app/services/explain.py`): the action shows 0 and a station issue below it is not listed.
- [x] Urgency limits in sessions: `high` from 10 sessions at risk, `medium` from 1.
- [x] An action can be opened again: `PATCH .../status` accepts `open`, and the "Pending" button in the action drawer now works with the live API. "Reset demo" (Stage 9) opens all of them at once.
- [x] Tests: three new ones in `tests/test_queueing.py`; `tests/test_priority.py`, `tests/test_demo_state.py` and `tests/test_firestore_actions.py` updated (103 pass).

What the numbers are now, at 7am:

| Demo time | Total at risk before | Now | The actions with money |
| --- | --- | --- | --- |
| Safety faults (Fri 10 Jan) | USD 0 | USD 38 | JPL congestion 25, a driver-reported charger at South Wilson 5, the JPL safety fault 5, South Wilson capacity 3 |
| Most chargers down (Tue 4 Feb) | USD 35 | USD 125 | JPL capacity 95 (13 before), charger 10 at JPL 17 (23 before), South Wilson capacity 13 |
| Weekday morning rush (Tue 25 Feb) | USD 69 | USD 128 | JPL capacity 107 (49 before), charger 10 at JPL 17 (20 before), South Wilson capacity 4 |
| Quiet Sunday (23 Feb) | USD 55 | USD 76 | JPL congestion on Monday 55 (35 before), two chargers at JPL 9 and 8 (10 and 10 before), South Wilson capacity 4 |

How good the new estimate is, over the three months, in sessions lost when one charger is down the whole time:

| Garage | Replay of the cars that really came | Forecast as it is (before) | Forecast with random arrivals (now) |
| --- | --- | --- | --- |
| South Wilson (4 chargers) | 18 | 4 | 22 |
| JPL (52 chargers) | 24 | 8 | 12 |
| California Garage 01 and 02 | 0 | 0 | 0 |

So it is close at South Wilson and still low at JPL, where ML's forecast is about 7% under the real arrivals. For a single charger at JPL the amount went slightly down (17 against 20 to 23): the old rule jumped when the forecast crossed the number of chargers, the new one is smoother.

What did not change: waiting times everywhere (map, station page, what-if "59.1 to 57.2 minutes"), and the whole backtest (412 queue minutes saved, USD 10 protected), because those numbers are on the slides.

Assumptions and limits to confirm with the team:

- The amounts are still small. This is what the data says: a session is worth USD 10, and a garage with a free charger loses nothing when another one breaks. A charger down at JPL costs about USD 17 over three days at the busiest time.
- Station capacity is now on the list on 81 of the 89 days (16 before) and is the first item on 70 of them, mostly "Add chargers" at JPL. That follows from the ranking rule (most money at risk first). It cannot be checked against what really happened, because a car that found the garage full left no session in the data.
- The backtest still uses the forecast as it is. With random arrivals its week would read USD 5.68 protected in place of USD 10: lower, because the old rule happened to cross a limit that week. The rule on the Results page and the rule on the Actions page are therefore not the same until the team decides which number to show.
- 500 runs: `/api/actions` answers in about 0.25 s (0.15 s before).

Files to review: `app/services/queueing.py` (`expected_unserved`, `_walk`), `app/services/priority.py` (`outlook`, `_urgency`, the two limits), `app/services/explain.py`, `app/schemas/action.py`; in the frontend `src/features/actions/components/ActionDetailDrawer.tsx` and `src/services/action-service.ts`.

How to test: `pytest -v` shows 103 passed. With the backend running locally, open the Actions page: "Safety faults" shows USD 38 at risk and "Weekday morning rush" USD 128. Open an action, choose "Completed", find it again under the "Completed" filter and choose "Pending": it is back on the active list.
