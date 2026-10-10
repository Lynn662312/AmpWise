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
| 6 | Frontend integration (on ML's real data) | Done; walkthrough by a person still to do |
| 7 | ML integration (Colab outputs) | Done |
| 8 | Deploy, Firestore and optional extras | Backend on Render, frontend on Vercel, action status on Firestore; live site is one merge behind |

## What is left (updated 2026-10-11, after the deployment check)

Live now: the website is at `https://ampwise.vercel.app` and the API at `https://portpulse-ampwise-api.onrender.com/api`. Both deploy from the branch `main`, and the website is allowed through CORS. They work, but they show the version from before contract v0.6 and v0.7: sample numbers on the overview, no charger lists, the old ranking, two demo times, the week of 10 Dec in the results.

1. [ ] Merge the pull request from `final` into `main`. The work (contract v0.6 and v0.7, backend, frontend, `backend/data/`) is committed and pushed on `final`, with `main` already merged in. After the merge Render and Vercel redeploy by themselves and the live site shows the current version. On this work 86 backend tests and 1 ML test pass, and the frontend type-checks and builds.
2. [ ] After the redeploy, walk every page once on the live site as a person (Stage 6).
3. [ ] To switch on "assign / mark done" on the live site: check that `FIREBASE_CREDENTIALS` is set in the Render dashboard (it is a secret, so it is not in `render.yaml`), then set `VITE_ACTION_STATUS_ENABLED=true` in Vercel and redeploy the frontend (Stage 8).
4. [ ] Optional: saved what-if runs and demo reset (Stage 8); AI advice with a real key (Stage 4).

Settled: ML integration; revenue per session USD 10; demo times and backtest week picked from the data by rule; site issues removed; money from charger capacity; cleaned feedback reviewed; backtest numbers handed over; "same chargers" checked and not needed (Stage 7).

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

- [x] `app/services/queueing.py` — `erlang_c`, `predict_wait` for the queue; `service_capacity`, `served_sessions`, `unserved_sessions` for money (v0.6, replacing `lost_sessions`); handle zero working chargers and demand above capacity
- [x] `tests/test_queueing.py` — known inputs give known waits
- [x] `scripts/make_dummy_data.py` — writes `stations.parquet`, `forecasts.parquet`, `health.parquet`, `fault_labels.parquet`, `params.json` with the columns in contract section 5
- [x] `app/services/data_loader.py` — loads those files once at startup (only when `MOCK=0`)
- [x] `app/services/classifier.py` — `classify_station`, `classify_charger`, `working_chargers`
- [x] `tests/test_data_and_classifier.py`

How to test: `pytest -v` shows 28 passed. `python -m scripts.make_dummy_data` writes the dummy files to `DATA_DIR`. That is now `backend/data/`, which holds ML's real converted files, so only run it if you want the dummy data back; `git restore backend/data` undoes it.

Assumptions to confirm with the team:

- When demand is at or above capacity the wait is reported as 120 minutes (the formula gives infinity).
- Sessions a station cannot serve in one slot = forecast arrivals above capacity, where capacity = working chargers × 30 ÷ average charge time. Nothing is inferred from the waiting time (v0.6; the earlier "drivers leave after 45 minutes" assumption is removed).
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

How money at risk is calculated (v0.6), per 30-minute forecast slot and summed over the next 72 hours:

- capacity = working chargers × 30 ÷ average charge time; served = the smaller of arrivals and capacity; unserved = arrivals above capacity.
- Charger flagged by its sensors: `p_fault` × (unserved now − unserved with one more charger working) × `rm_per_session`.
- Driver-reported charger with healthy sensors: (unserved with one charger fewer − unserved now) × `rm_per_session`.
- Congestion or chronic undercapacity: unserved with every installed charger working × `rm_per_session`.
- Underused: 0.

These are estimated unserved sessions, not customers seen leaving. The reason sentence says "an estimated N sessions are at risk".

Reports come from `user_reports.parquet`, which the converter writes from ML's cleaned feedback, `feedback_clean.csv` (Stage 7 has the rule). The converter is the one place where ML's names and categories are turned into ours.

What needs storing: see the table in Stage 8. In short, nothing from the ML files; only what people change in the app.

Assumptions to confirm with the team:

- `rm_at_risk` looks 72 hours ahead.
- A broken charger costs nothing while the other chargers can still serve the whole forecast; it costs money only when demand is above the remaining capacity.
- Station congestion that disappears once faulty chargers are fixed (peak wait back to 40 minutes or less with every charger working) is not listed separately.
- Deadline = the first slot where forecast demand is above capacity; a safety fault's deadline is now. No deadline when demand stays within capacity.
- Urgency: safety fault is `critical`; otherwise `high` from RM 1,000, `medium` from RM 200, else `low`.
- `/api/meta` takes `time_range`, `assumptions` and `backtest_weeks` from the data, and the name, currency, holidays and demo times from `meta.json`, which the converter writes.

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
- [x] Give the backtest numbers to whoever makes slides: handed over on 2026-10-11 (week of 3 to 9 Feb 2020; the numbers are under "Known limits" in Stage 7)

How to test: `pytest -v` shows 56 passed. With `MOCK=0`, fixing `stn_003_c1` at the "Day before Raya exodus" time lowers the wait and raises revenue, and `/api/backtest` shows `queue_minutes_saved` above zero.

How the backtest works (reworked for ML's real faults; assumptions to confirm with the team):

- It replays one week. Without a choice that is the 7 days with the most chargers out of service, because that week has the most to test (the earliest such week on a tie): 3 to 9 Feb 2020 on the real data. `week` picks another one from `meta.backtest_weeks`: the default first, then every Monday-to-Sunday week inside the data (12 in all). An unknown `week` gives a 400.
- Baseline is what really happened: each charger is down from the day its fault starts to the day it was really repaired (`end_date` in `fault_labels.parquet`, ML's `end`).
- `rm_protected` = (baseline unserved sessions − our unserved sessions) × revenue per session, with the capacity formula from Stage 3 (v0.6). Queue minutes still come from the queueing model.
- Ours: a fault is known the day the sensors flag it, or on its second driver report on the charger during the fault. One technician repairs one known fault per day, in action-list order, and the charger works again the next day.
- A fault we never notice still ends on its real repair day, so ours is never worse than the baseline.
- Every real fault counts as "charger down", including the ones only drivers can see (damaged cable, blocked bay).
- A file without `end_date` (the dummy data has one, three days after each fault starts) is treated as "not repaired within the week".
- Rerouting drivers to other stations is not simulated.
- Forecast error compares the model and "same slot last week" against `arrivals_actual`.
- Precision and recall compare the chargers the sensors flagged with the chargers in `fault_labels.parquet`.

What-if looks 72 hours ahead. Revenue = the sessions the chargers can serve (capacity formula) × revenue per session (v0.6). "Fix now" compares the working chargers with one more; "add chargers" compares them with the requested number more. The wait shown next to it still comes from the queueing model.

## Stage 6 — Frontend integration (on ML's real data) — Done; walkthrough by a person still to do

In plain words: the frontend stops reading its own sample files and asks the backend instead.

The frontend has a switch in `frontend/.env`: `VITE_DATA_MODE=mock` reads the JSON files in `frontend/src/data/`, `VITE_DATA_MODE=api` calls the backend at `VITE_API_BASE_URL`.

- [x] Backend and frontend branches merged into `main`
- [x] Backend runs with `MOCK=0` on ML's real files
- [x] Frontend runs with `VITE_DATA_MODE=api`
- [x] Mismatches fixed contract first (v0.6 and v0.7)
- [x] Pages checked against the live API on 2026-10-11: overview, station detail, what-if, results and actions were rendered in a headless browser against a local backend and their text was checked
- [ ] Walk every page once in the browser as a person (clicking, running a what-if, opening an action)

Which backend the frontend talks to: `frontend/.env` points `VITE_API_BASE_URL` at the deployed backend on Render, and so does the live website on Vercel. That server runs `main`, so it does not have contract v0.6 and v0.7 until `final` is merged. Until then the changed frontend still works against it, but shows the sample overview numbers and empty charger lists. To test against the code on this machine, set `VITE_API_BASE_URL=http://localhost:8000/api` and start the backend locally (its `CORS_ORIGINS` already allows `http://localhost:5173`).

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

Still open in the frontend:

- [ ] Assign / mark done: the backend route now exists (Stage 8), but the frontend keeps it off while `VITE_ACTION_STATUS_ENABLED=false`. Set it to `true` in `frontend/.env` and in Vercel once Firestore is confirmed on Render
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
- With the capacity formula (v0.6) a broken charger costs money only where demand is above capacity, which here means JPL at the morning peak. Of the 40 charger-days with a sensor fault, 20 show money at risk, at most USD 15. Three things keep it small. The Caltech garages with 24 and 54 chargers are under 10% busy, so losing one charger changes nothing there. One charger serves only 0.13 to 0.19 sessions per half hour, because a charge takes two to four hours. And most faults are repaired within a day or two.
- The different charger counts in ML's two deliveries (the forecast covers every charger, `acn_synth` a 20% sample) are not the cause. Checked on 2026-10-11 by scaling every station to its sensor chargers with demand scaled the same: money at risk for sensor faults over the three months is USD 171 against USD 160, and the backtest avoids 2.9 estimated unserved sessions against 2.6. So ML does not need to rebuild anything for this.
- Over the 89 days checked at 7am, the list showed a sensor fault on 40 charger-days and a driver-reported charger on 162. With the v0.6 ranking the first item was a capacity or congestion issue (JPL or South Wilson) on 70 days, a driver-reported charger on 13 and a safety fault on 6.

Known limits:

- Health is per day. A charger counts as faulty for the whole of every California day its fault touches, so at 7am the list can already show a fault that starts later that day.
- After a sensor fault clears, the driver reports made during it still count for 7 days, so the charger can stay on the list as "Inspect charger" for a few days.
- Power does not drop before a fault in this data (it follows how the cars charge), so the charger chart does not show a decline, and the reason for a `degraded` charger quotes the charger's own message instead of a power percentage.
- The sentiment model only knows the wording in this data set. A comment in completely new words can be read wrongly, so it has to be re-run (and re-checked) when ML sends new feedback.
- The capacity formula is a throughput estimate. Demand that cannot be served in one slot is counted as unserved there; it is not carried into the next slot, and a long session is not followed from slot to slot.
- The backtest gain is small on this data. In its week (3 to 9 Feb 2020, nine real faults) it saves 412 queue minutes and protects USD 4 (0.4 estimated unserved sessions). Over the whole three months it is 653 of about 199,000 queue minutes, and 2.6 of 560 estimated unserved sessions (about USD 26). The reasons are the ones under "What the real data shows": quiet garages, long charges, and faults that are repaired within a day or two anyway. Of the 33 real faults we know 25 on the day they start and never notice 3.
- Backtest precision is 1.0 because the status comes from the charger's own fault message; recall is 0.8 because the sensors cannot see the faults only drivers report.

Done:

- [x] `scripts/convert_ml_outputs.py` — reads ML's files with ML's own column names, converts UTC to California time, takes charger count, power and charge time per station from `station_profile.csv`, and writes all the files the backend reads
- [x] Sensor results, real faults and driver reports now come from `acn_synth/`; the placeholders are gone
- [x] Station coordinates come from `acn_synth/stations.csv` (the average of each station's chargers)
- [x] v0.6: money from charger capacity (estimated unserved sessions) for `rm_at_risk`, what-if revenue and `rm_protected`; `max_tolerable_wait_min` removed everywhere; new ranking (safety, then money at risk, then underused)
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
- [ ] Merge `final` into `main`, so the live site gets contract v0.6 and v0.7 (see "What is left")
- [ ] Check `FIREBASE_CREDENTIALS` in the Render dashboard. It cannot be read from outside; without it the status route answers 500 "Firestore is not configured"
- [ ] Set `VITE_ACTION_STATUS_ENABLED=true` in Vercel (and in `frontend/.env`) to show assign / mark done
- [ ] Not built: `POST /api/demo/reset` and `/api/scenarios`. Also, the contract says a charger action marked done counts as working again; today a done action only leaves the list
- [ ] Run the full demo twice against the deployed backend

Environment variables, all checked on 2026-10-11:

| Where | Variable | State |
| --- | --- | --- |
| Render | `MOCK`, `DATA_DIR`, `CORS_ORIGINS`, `PYTHON_VERSION` | Set in `render.yaml` |
| Render | `FIREBASE_CREDENTIALS` | Secret, set by hand in the dashboard; to confirm |
| Render | `LLM_API_KEY`, `LLM_MODEL` | Not set: advice uses the templates |
| Vercel | `VITE_API_BASE_URL`, `VITE_DATA_MODE=api` | Set (the live site calls the Render API) |
| Vercel | `VITE_ACTION_STATUS_ENABLED` | Still to switch to `true` |
| `backend/.env` | all six | Present; the two AI ones are empty on purpose |
| `frontend/.env` | all three | Present; `VITE_ACTION_STATUS_ENABLED=false` |

What is stored where. The frontend only ever calls the backend API, on a teammate's machine and when deployed:

| What the frontend shows | Where it comes from | Database? |
| --- | --- | --- |
| Stations, forecasts, charger health, action list, driver report counts, pie chart percentages | The files in `backend/data/`, loaded into memory when the server starts | No. They are read-only, the same for everyone, and deployed with the code |
| A what-if simulation result | Calculated on request from the same files | No |
| Saved what-if runs (`/api/scenarios`) | Someone clicking "save" | Yes: Firestore `scenarios` (to build) |
| Action status: open, assigned, done | Someone clicking in the app | Yes: Firestore `actions_status` (built) |
| AI advice | The AI provider, cached | Optional: Firestore `advice_cache`, so it survives restarts |

Firestore is needed for the "Yes" rows because free hosting puts the server to sleep and its memory is lost. Action status is built; saved what-if runs are not. Everything else works without a database.
