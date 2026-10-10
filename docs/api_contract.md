# AmpWise API Contract 

> Lives at `AmpWise/docs/api_contract.md`.
> This is the single source of truth between backend, frontend and ML.
> Change this file first (and tell the team), then change code.

Version: v0.7 · 2026-10-11

> **v0.3 — the data is now US (ACN dataset, California), not Malaysia.**
> - **Time:** station local time with its offset, e.g. `2019-12-24T09:00:00-08:00`. The data covers 2019-12-01 to 2020-02-29; always read the real range from `meta.time_range`.
> - **Money:** USD. Field names keep the `rm_` prefix for now (`rm_at_risk`, `rm_per_session`, …); read the currency from `meta.currency`.
> - **Festive:** no longer a focus. `is_festive` and `meta.festive_periods` still exist and only label US public holidays (ML's `is_holiday`); no demand multiplier is applied. The demo is about the weekday morning rush.
> - The examples below still show the earlier Malaysian placeholders (names, dates, `+08:00`, RM). The field names and shapes are still correct.
>
> **v0.6 — money comes from charger capacity, not from waiting time.**
> - The 45-minute "drivers give up" assumption is gone, and `max_tolerable_wait_min` no longer exists anywhere.
> - `rm_at_risk`, what-if revenue and `rm_protected` are now based on **estimated unserved sessions**: forecast demand above what the working chargers can serve. See "Estimated revenue at risk" in section 4.
> - Waiting times (`predicted_wait_min`, `wait_min`, wait levels, congestion) are unchanged and still come from the queueing model.
> - The action list has a new sort order, and the issue type `site_issue` is removed.
>
> **v0.7 — three additions so the frontend needs no sample data.**
> - `GET /api/stations/{station_id}/chargers`: the chargers of a station, for the charger pickers.
> - `GET /api/overview`: energy delivered, live sessions and uptime from ML's real session files (it was a fixed placeholder).
> - `meta.backtest_weeks` lists the weeks `/api/backtest?week=` accepts.

---

## 1. Conventions / 通用约定

| Item | Rule |
| --- | --- |
| Base URL | Dev: `http://localhost:8000/api` · Prod: frontend reads `VITE_API_BASE_URL` |
| Format | JSON, `snake_case` field names |
| Time | ISO 8601 with offset, Malaysia time: `2026-03-30T14:00:00+08:00` |
| Slots | 30 minutes |
| `time` param | The simulated "now" for the demo. Required on every data endpoint. Must be inside `meta.time_range`. |
| IDs | Station `stn_001` · Charger `stn_001_c1` · Action `{issue_type}:{station_id}:{charger_id or "-"}` (stable across calls) |
| Money | RM, number with 2 decimals |
| Minutes | number, 1 decimal |
| Mock mode | Backend env `MOCK=1` → every endpoint returns the examples in this file |
| AI key | Lives only in backend `.env` (`LLM_API_KEY`). Never in frontend code. |

### Error format / 错误格式

All non-2xx responses:

```json
{ "error": { "code": "not_found", "message": "Station stn_999 does not exist" } }
```

| HTTP | code | When |
| --- | --- | --- |
| 400 | `bad_request` | Invalid params (e.g. `time` outside range) |
| 404 | `not_found` | Unknown station / charger / action id |
| 502 | `llm_unavailable` | AI provider failed and no fallback was possible (should be rare) |
| 500 | `internal` | Anything else |

---

## 2. Enums / 枚举

```ts
type IssueType =
  | "safety_fault"          // 安全故障 (leakage / overheating trend)
  | "degraded"              // 性能衰退 (low power ratio)
  | "connector_fault"       // 接口故障 (many failed / short sessions)
  | "user_reported"         // 用户报修 (v0.4: drivers reported it, sensors show no fault)
  | "congestion"            // 短期拥堵
  | "chronic_undercapacity" // 长期容量不足
  | "underused";            // 使用率过低

type ChargerStatus = "healthy" | "degraded" | "connector_fault" | "safety_fault";
type Urgency = "critical" | "high" | "medium" | "low";
type WaitLevel = "green" | "amber" | "red";   // green < 15 min, amber 15–40, red > 40
type ActionState = "open" | "assigned" | "done";
```

---

## 3. Types / 数据类型

```ts
interface Meta {
  corridor_name: string;            // "KL – Penang (PLUS E1)"
  currency: string;                 // "USD" (v0.3)
  time_range: { start: string; end: string };
  festive_periods: { name: string; start: string; end: string }[];
  demo_times: { label: string; time: string }[];   // preset slider points
  backtest_weeks: { value: string; label: string }[];   // v0.7: weeks /api/backtest accepts; the first is the default
  assumptions: { rm_per_session: number; avg_charge_min: number };   // v0.6: max_tolerable_wait_min removed
}

interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  n_chargers: number;
  n_working: number;
  power_kw: number;
  predicted_wait_min: number;
  level: WaitLevel;
  open_issue_count: number;
}

interface StationCharger {         // v0.7: one charger of a station
  charger_id: string;              // accepted by /api/chargers/{charger_id}/health and by what-if fix_now
  station_id: string;
  power_kw: number;                // the station's rated power per charger
  status: ChargerStatus;           // at the given time
}

interface ForecastSlot {
  slot_start: string;
  arrivals: number;
  arrivals_baseline: number;       // "same slot last week"
  wait_min: number;
  is_festive: boolean;
}

interface PowerRatioPoint {
  date: string;                    // YYYY-MM-DD
  ratio: number;                   // actual / rated, 0–1
  baseline: number;                // charger's own 7-day median
}

interface ChargerHealth {
  charger_id: string;
  station_id: string;
  status: ChargerStatus;
  p_fault: number;                 // 0–1
  evidence: string[];              // ["Power at 41% of 7-day median for 4 sessions"]
  series: PowerRatioPoint[];
  degraded_since: string | null;
}

interface Action {
  id: string;
  rank: number;
  issue_type: IssueType;
  station_id: string;
  station_name: string;
  charger_id: string | null;
  recommended_action: string;      // short label: "Schedule maintenance"
  rm_at_risk: number;              // v0.6: estimated revenue at risk over the next 72 hours (see section 4)
  deadline: string | null;         // v0.6: first slot where demand is above capacity; "now" for a safety fault
  urgency: Urgency;
  reason: string;                  // template sentence, always present, no AI
  report_count: number;            // v0.4: driver reports in the last 7 days (0 for station issues)
  first_reported_at: string | null; // v0.4: time of the earliest of those reports
  state: ActionState;
}

interface Advice {                 // AI-generated, on demand
  action_id: string;
  summary: string;                 // 1–2 sentences
  steps: string[];                 // 2–5 concrete steps
  caveats: string[];               // assumptions / uncertainty
  source: "llm" | "template";      // "template" = fallback was used
  cached: boolean;
}

interface WhatIfRequest {
  scenario: "fix_now" | "add_chargers" | "discount";
  time: string;
  station_id: string;
  charger_id?: string;             // fix_now
  n_chargers?: number;             // add_chargers
  discount_pct?: number;           // discount, 0–50
}

interface WhatIfResult {
  before_wait_min: number;
  after_wait_min: number;
  before_revenue_rm: number;       // v0.6: sessions served over the next 72 hours × rm_per_session
  after_revenue_rm: number;
  summary: string;
}

interface ReportCategory {          // v0.5: one slice of the feedback pie chart
  category: string;                // ML's own category name, e.g. "Won't start"
  count: number;                   // complaints in this category
  percentage: number;              // share of all counted complaints, 0-100, 1 decimal
}

interface Overview {               // v0.7: network totals at the given time
  data_source: "api" | "placeholder";   // "placeholder" only in mock mode
  energy_delivered_kwh: number;         // delivered on the simulated day, from midnight to `time`
  energy_delivered_week_kwh: number;    // the 7 days ending at `time` (the sum of energy_trend)
  live_sessions: number;                // cars plugged in at `time`
  network_uptime_pct: number;           // share of charger-days without a fault over those 7 days, 0-100
  energy_trend: { date: string; kwh: number }[];   // those 7 days, oldest first; the last one is today so far
}

interface BacktestResult {
  week_label: string;
  queue_minutes_saved: number;
  rm_protected: number;            // v0.6: (baseline unserved sessions − our unserved sessions) × rm_per_session
  forecast_mae_ours: number;
  forecast_mae_baseline: number;
  fault_precision: number;
  fault_recall: number;
  daily: { date: string; wait_baseline_min: number; wait_ours_min: number }[];
}
```

---

## 4. Endpoints / 接口

★ = required for demo.

### ★ GET `/api/meta`

Response `200`: `Meta`

```json
{
  "corridor_name": "KL – Penang (PLUS E1)",
  "time_range": { "start": "2026-03-16T00:00:00+08:00", "end": "2026-04-05T23:30:00+08:00" },
  "festive_periods": [{ "name": "Hari Raya exodus", "start": "2026-03-27T00:00:00+08:00", "end": "2026-03-30T23:30:00+08:00" }],
  "demo_times": [
    { "label": "Normal Tuesday", "time": "2026-03-17T14:00:00+08:00" },
    { "label": "Day before Raya exodus", "time": "2026-03-26T14:00:00+08:00" }
  ],
  "backtest_weeks": [{ "value": "2026-03-23", "label": "Week of 23 Mar 2026" }],
  "assumptions": { "rm_per_session": 35.0, "avg_charge_min": 38 }
}
```

(Dates and RM values above are placeholders until the team confirms them.)

`demo_times` is ordered most interesting first; a client can open on the first entry. On the current data: "Safety faults" 2020-01-10, "Most chargers down" 2020-02-04, "Weekday morning rush" 2020-02-25, "Quiet Sunday" 2020-02-23, all at 07:00 California time.

### ★ GET `/api/stations?time=`

Response `200`: `Station[]`

```json
[{
  "id": "stn_003", "name": "Seremban R&R", "lat": 2.725, "lon": 101.94,
  "n_chargers": 4, "n_working": 3, "power_kw": 60,
  "predicted_wait_min": 55.0, "level": "red", "open_issue_count": 2
}]
```

### ★ GET `/api/stations/{station_id}/forecast?start=&hours=`

`hours` default 24, max 72. Response `200`: `ForecastSlot[]`

```json
[{ "slot_start": "2026-03-26T14:00:00+08:00", "arrivals": 9.4, "arrivals_baseline": 6.0, "wait_min": 22.5, "is_festive": false }]
```

### GET `/api/stations/{station_id}/chargers?time=` (v0.7)

Response `200`: `StationCharger[]`, in charger order. `404` for an unknown station.

Only the chargers that have sensor data are listed, so the list can be shorter than `n_chargers` (on the current data 6, 5, 2 and 10 chargers for the four stations). A station with none returns `[]`. Clients must take charger ids from here or from the action list, never build them from `n_chargers`.

```json
[
  { "charger_id": "stn_003_c1", "station_id": "stn_003", "power_kw": 60, "status": "degraded" },
  { "charger_id": "stn_003_c2", "station_id": "stn_003", "power_kw": 60, "status": "healthy" }
]
```

### ★ GET `/api/chargers/{charger_id}/health?time=&days=`

`days` default 14. Response `200`: `ChargerHealth`

```json
{
  "charger_id": "stn_003_c1", "station_id": "stn_003",
  "status": "degraded", "p_fault": 0.86,
  "evidence": ["Power at 41% of 7-day median for 4 sessions", "Session success rate 92% (normal)"],
  "series": [{ "date": "2026-03-20", "ratio": 0.95, "baseline": 0.94 }, { "date": "2026-03-24", "ratio": 0.41, "baseline": 0.93 }],
  "degraded_since": "2026-03-23"
}
```

### ★ GET `/api/actions?time=&limit=`

`limit` default 20. Response `200`: `Action[]`

Sort order (v0.6). Money at risk is the main business priority:

1. `safety_fault`, always first.
2. Every other charger and station issue that can cost revenue (`degraded`, `connector_fault`, `user_reported`, `congestion`, `chronic_undercapacity`), in one list: `rm_at_risk` descending. Ties: `report_count` descending.
3. `underused`, which never has money at risk, after all of those.

So a charger with few driver reports but high `rm_at_risk` ranks above a charger with many reports and no money at risk.

`user_reported` = a charger with 2 or more driver reports in the last 7 days whose sensors show no fault.
Driver reports on a charger the sensors already flag do not create a second action; they raise that action's `report_count`.

v0.6: `site_issue` is removed. Complaints about a blocked or dirty bay no longer create an action; they are counted only in `/api/reports/categories`.

#### Estimated revenue at risk (v0.6)

Nothing is inferred from how long drivers wait. For each 30-minute forecast slot:

```
capacity          = working_chargers × 30 ÷ avg_charge_min
served_sessions   = min(arrivals, capacity)
unserved_sessions = max(0, arrivals − capacity)
```

`rm_at_risk` sums this over the next 72 hours (fractions of a session are fine, because these are forecasts):

| Issue | Sessions at risk | `rm_at_risk` |
| --- | --- | --- |
| Charger flagged by its sensors (`safety_fault`, `degraded`, `connector_fault`) | unserved with `n_working` − unserved with `n_working + 1` | `p_fault` × sessions at risk × `rm_per_session` |
| `user_reported` (sensors look healthy) | unserved with `n_working − 1` − unserved with `n_working` | sessions at risk × `rm_per_session` |
| `congestion`, `chronic_undercapacity` | unserved with every installed charger working | sessions at risk × `rm_per_session` |
| `underused` | — | 0 |

These are estimates of sessions the station cannot serve, not observed customers who left. In text, call them "estimated unserved sessions", "sessions at risk" and "estimated revenue at risk".

```json
[{
  "id": "degraded:stn_003:stn_003_c1", "rank": 1,
  "issue_type": "degraded", "station_id": "stn_003", "station_name": "Seremban R&R",
  "charger_id": "stn_003_c1", "recommended_action": "Schedule maintenance",
  "rm_at_risk": 2300.00, "deadline": "2026-03-26T18:00:00+08:00", "urgency": "high",
  "reason": "Fix Charger 1 at Seremban R&R by Thursday 6pm. It is delivering 41% of rated power, and Friday's forecast is a 55-minute queue.",
  "state": "open"
}]
```

### ★ POST `/api/actions/{action_id}/advice`  (AI)

Body:

```json
{ "time": "2026-03-26T14:00:00+08:00", "language": "en" }
```

`language`: `"en"` | `"zh"` | `"ms"`. Response `200`: `Advice`

```json
{
  "action_id": "degraded:stn_003:stn_003_c1",
  "summary": "Charger 1 has delivered under half its rated power since Monday. Fixing it before Friday keeps the Raya peak queue near 25 minutes instead of 55.",
  "steps": ["Dispatch a technician before Thursday 6pm", "Check power module and cable temperature", "If not fixable in time, redirect drivers to Nilai R&R via the app"],
  "caveats": ["RM per session is an assumed RM 35"],
  "source": "llm",
  "cached": false
}
```

Rules for the backend (judges will ask how the AI is controlled):

1. The AI only **explains and suggests steps**. Ranking, RM numbers and fault status come from our models, never from the AI.
2. The prompt receives a fixed JSON of facts (action + health evidence + forecast). The AI must not introduce numbers that are not in that JSON.
3. Timeout 8 s. On error or timeout → return a template-based `Advice` with `source: "template"` (still `200`).
4. Cache by `(action_id, time, language)`. Pre-warm the cache for `meta.demo_times` before the demo.

### PATCH `/api/actions/{action_id}/status`

Body: `{ "state": "assigned" | "done" }` → Response `200`: `Action` (updated). Stored in Firestore `actions_status/{action_id}`. A charger action marked `done` counts as working again in later calls.

### POST `/api/demo/reset`

Clears all `actions_status` (and optionally `scenarios`) so every demo run starts clean. Does **not** clear the advice cache.
Body: `{ "clear_scenarios": false }` → Response `200`: `{ "cleared_actions": 3, "cleared_scenarios": 0 }`

### POST `/api/scenarios` · GET `/api/scenarios`

Save / list what-if runs.
POST body: `{ "name": "Fix Seremban before Raya", "request": WhatIfRequest, "result": WhatIfResult }` → `201` with `{ "id": "...", ...same }`.
GET → list, newest first.

### ★ POST `/api/whatif`

Body: `WhatIfRequest` → Response `200`: `WhatIfResult`

```json
{
  "before_wait_min": 55.0, "after_wait_min": 24.0,
  "before_revenue_rm": 6100.00, "after_revenue_rm": 8400.00,
  "summary": "Fixing Charger 1 now cuts Friday's peak wait from 55 to 24 minutes and protects about RM 2,300."
}
```

The `discount` scenario is not available: the backend answers `400 bad_request`, and clients should not offer it (v0.7).

v0.6: revenue = sessions served over the next 72 hours × `rm_per_session`, with the same capacity formula as `rm_at_risk`. `fix_now` compares the current working chargers with one more; `add_chargers` compares them with `n_chargers` more. The wait values still come from the queueing model.

### ★ GET `/api/backtest?week=`

`week` is optional. Response `200`: `BacktestResult`

v0.6: `rm_protected` = (baseline unserved sessions − our unserved sessions) × `rm_per_session`. `queue_minutes_saved` and the daily waits still come from the queueing model.

v0.7: `week` is one of the `value`s in `meta.backtest_weeks` (the Monday the week starts on, `YYYY-MM-DD`). Without `week` the backend replays the first entry: the week with the most chargers out of service (on the current data, 3 to 9 Feb 2020). An unknown `week` gives `400 bad_request`.

### GET `/api/overview?time=` (v0.7)

Network totals for the dashboard. Response `200`: `Overview`.

Everything is counted up to the simulated `time`, never beyond it:

- Energy comes from ML's 30-minute energy file (`site_load_30min.csv`), for the stations that have a forecast.
- Live sessions come from ML's session file (`acn_sessions.csv`): sessions that started at or before `time` and have not ended.
- Uptime is historical: of all charger-days in the 7 days ending at `time`, the share on which the charger reported no fault. Only chargers with sensors count.

ML's session files cover a 20% sample of the chargers, so these totals are smaller than the full garages in the forecast. In mock mode (`MOCK=1`) the endpoint returns fixed sample numbers with `data_source: "placeholder"`.

```json
{
  "data_source": "api",
  "energy_delivered_kwh": 41.2,
  "energy_delivered_week_kwh": 1284.5,
  "live_sessions": 9,
  "network_uptime_pct": 97.5,
  "energy_trend": [{ "date": "2020-01-04", "kwh": 96.1 }, { "date": "2020-01-10", "kwh": 41.2 }]
}
```

### GET `/api/reports/categories` (v0.5)

Data for the pie chart of driver complaints. Response `200`: `ReportCategory[]`, largest first.

No `time` parameter: it is counted once over all of ML's cleaned feedback (every charger, every date).
Counted: the rows the ML cleaning step marked `keep` (the comment reads as negative and is not spam). Left out: positive comments and spam. The category `Other` stays, with only its real complaints. `Payment issue`, `Blocked by non-EV` and `Cleanliness` are counted here although they never appear in the action list.

```json
[
  { "category": "Blocked by non-EV", "count": 314, "percentage": 23.3 },
  { "category": "Other", "count": 269, "percentage": 20.0 }
]
```

### GET `/api/health`

Response `200`: `{ "status": "ok", "mock": false, "llm_configured": true }`

---

## 5. ML → Backend files / ML 交付文件

Backend reads these at startup. Path set by `DATA_DIR` in backend `.env`.

| File | Columns | Owner |
| --- | --- | --- |
| `stations.parquet` | station_id, name, lat, lon, n_chargers, power_kw | ML 1 |
| `forecasts.parquet` | station_id, slot_start, arrivals, arrivals_baseline, is_festive | ML 1 |
| `health.parquet` | charger_id, station_id, date, power_ratio, baseline, status, p_fault, evidence | ML 2 |
| `fault_labels.parquet` | charger_id, fault_type, start_date; v0.5 optional: end_date (the day the fault was really repaired) | ML 2 |
| `params.json` | avg_charge_min, rm_per_session (v0.6: max_tolerable_wait_min removed) | ML 1 + team |
| `meta.json` (v0.3) | corridor_name, currency, festive_periods, demo_times | Backend |
| `report_categories.json` (v0.5, optional) | list of category, count, percentage (the `/api/reports/categories` response) | Backend (converter) |
| `energy.parquet` (v0.7, optional) | station_id, slot_start, energy_kwh (energy delivered per 30-minute slot) | Backend (converter) |
| `sessions.parquet` (v0.7, optional) | station_id, started_at, ended_at (one row per charging session) | Backend (converter) |
| `user_reports.parquet` (v0.4, optional) | charger_id, reported_at (one row per driver report about the charger, timestamp with offset). v0.6: the optional issue_type column is gone | ML |

Dummy versions with the right columns are due by hour 3.

v0.3: `forecasts.parquet` may also carry `arrivals_actual` (what really happened), used by the backtest.
v0.4: `stations.parquet` may also carry `avg_charge_min` (that station's own average charge time); when present it replaces the shared value in `params.json`.
v0.5: `health.parquet` may cover fewer chargers than `n_chargers` (only some chargers have sensors); a charger without rows counts as working. A charger can be faulty for some days and `healthy` again later, and can have several rows in `fault_labels.parquet`.

**What ML actually delivers** (in `ml/output/` on `main`). ML's own names are kept as they are; the backend renames them with `python -m scripts.convert_ml_outputs` (see `docs/backend_plan.md`, Stage 7).

| ML file | ML columns | Becomes |
| --- | --- | --- |
| `model1_test_predictions.csv` | station, slot_utc, slot_local, arrivals, pred, baseline_last_week, is_holiday, near_holiday, wait_min_all_up, wait_min_one_down | `forecasts.parquet`: station → station_id, slot_utc → slot_start (California time), pred → arrivals, baseline_last_week → arrivals_baseline, is_holiday → is_festive, arrivals → arrivals_actual. `near_holiday` and the two wait columns are not used. |
| `station_profile.csv` | station, sampled, mean_charge_min, median_charge_min, mean_kwh, rated_kw, energy_source, n_chargers, sessions_total | `stations.parquet`: n_chargers, rated_kw → power_kw, mean_charge_min → avg_charge_min. Names and coordinates are placeholders set in the converter. |
| `model1_metrics.json` | festive_multiplier_assumed, test_metrics, … | Not used by the backend (holidays are no longer a focus). |
| `acn_synth/stations.csv` | id, site_path, lat, lon, kw, … (one row per charger; ML calls a charger a "station") | Charger ids: `CAG1-003` at the site that is `stn_001` → `stn_001_c3`. Station `lat`/`lon` = the average of its chargers. Chargers at a site with no forecast are left out. |
| `acn_synth/ocpp_events.csv` (too large for git, shared outside the repo) | timestamp, station_id, action, status, error_code, power_w, … | `health.parquet`: a `StatusNotification` with status `Faulted` makes the charger faulty on every California day until its next status message. error_code → status: `HighTemperature`, `GroundFailure`, `OverCurrentFailure`, `OverVoltage` → `safety_fault`; `ConnectorLockFailure` → `connector_fault`; `PowerMeterFailure`, `WeakSignal` → `degraded`. `p_fault` is 1 while faulted, else 0. `power_ratio` = the day's median `power_w` ÷ rated `kw`, capped at 1, carried forward on days with no reading. ML's label columns (`fault_id`, `fault_type`, `phase`) are not read. |
| `acn_synth/fault_ground_truth.csv` | fault_id, station_id, fault_type, source, precursor_start, onset, end | `fault_labels.parquet`: station_id → charger_id, fault_type as it is, onset → start_date, end → end_date. `end` is when the fault was really repaired; the backtest uses it as "what really happened". |
| `acn_synth/feedback_clean.csv` (written by `ml/src/preprocessing/clean_feedback.py` from `feedback.csv`) | feedback_id, timestamp, station_id, category, rating, free_text, **sentiment, is_spam, keep**, … (one row = one report, with its own id) | `sentiment` (`positive` / `negative`) is read from the comment text, not from the star rating; `is_spam` marks comments that describe nothing; `keep` = negative and not spam. Only `keep` rows are used. `report_categories.json`: their count per category. `user_reports.parquet`: only the categories about the charger itself (`Won't start`, `Slow charging`, `Cable stuck`, `Connector damaged`, `Screen broken`, `Other`). `Blocked by non-EV`, `Cleanliness` and `Payment issue` are left out of the action list (v0.6). ML's answer columns (`true_station_id`, `ground_truth_origin`, `linked_fault_id`, `noise`) are not read. |
| `acn_synth/site_load_30min.csv` | timestamp, site, energy_kwh, power_kw, split | `energy.parquet` (v0.7): site → station_id, timestamp → slot_start (California time), energy_kwh as it is. Sites without a forecast are left out. |
| `acn_synth/acn_sessions.csv` | connectionTime, disconnectTime, site_path, kWhDelivered, … | `sessions.parquet` (v0.7): site_path → station_id, connectionTime → started_at, disconnectTime → ended_at. |
| Other `acn_synth` files | generator settings, raw frames, counts | Not used by the backend. |

---

## 6. Firestore (no login) / 数据库（不做登录）

Only the **backend** touches Firestore (Admin SDK). The frontend never reads or writes Firestore directly.

| Collection | Doc id | Fields | Why |
| --- | --- | --- | --- |
| `actions_status` | action id | state, updated_at | Mark assigned / done |
| `scenarios` | auto | name, request, result, created_at | Saved what-if runs |
| `advice_cache` | `{action_id}|{time}|{language}` | Advice + created_at | Survives server restarts (free hosting sleeps) |

Model outputs (forecasts, health) are **not** stored in Firestore — they stay in parquet, loaded into memory.

What needs storing and what does not (v0.4):

| Data the frontend shows | Where it comes from | Stored? |
| --- | --- | --- |
| Driver report count and time, sensor status and evidence, forecasts | ML files, served through the API | No, read-only |
| Maintenance status (open / assigned / done) and when it changed | Someone clicking in the app | Yes: `actions_status`, with `updated_at` |

`firebase/firestore.rules` — deny all client access, because there is no login:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```

---

## 7. Environment variables / 环境变量

| Where | Variable | Example |
| --- | --- | --- |
| backend | `MOCK` | `1` |
| backend | `DATA_DIR` | `./data` |
| backend | `CORS_ORIGINS` | `http://localhost:5173,https://ampwise.vercel.app` |
| backend | `LLM_API_KEY` | (secret, never commit) |
| backend | `LLM_MODEL` | provider's model name |
| backend | `FIREBASE_CREDENTIALS` | path or JSON of service account (secret) |
| frontend | `VITE_API_BASE_URL` | `http://localhost:8000/api` |
| frontend | `VITE_DATA_MODE` | `api` (call the backend) or `mock` (local sample files) |
| frontend | `VITE_ACTION_STATUS_ENABLED` | `true` once `PATCH /api/actions/{id}/status` is live with Firestore, else `false` |

---

## 8. Change log / 修改记录

| Date | Change | By |
| --- | --- | --- |
| 2026-10-11 | v0.7 new `GET /api/stations/{station_id}/chargers`; `GET /api/overview` now takes `time` and returns real totals (`energy.parquet`, `sessions.parquet`); new `meta.backtest_weeks`, and `/api/backtest?week=` uses it; `discount` what-if marked not available | |
| 2026-10-11 | v0.6 money from capacity: `rm_at_risk`, what-if revenue and `rm_protected` use estimated unserved sessions (demand above charger capacity); `max_tolerable_wait_min` removed from `Meta.assumptions` and `params.json`; new action sort order (safety, then everything by `rm_at_risk`, then `underused`); issue type `site_issue` and `user_reports.issue_type` removed | |
| 2026-10-10 | v0.5 ML sensor data (`acn_synth`): new issue type `site_issue` (ranked last), optional `user_reports.issue_type` and `fault_labels.end_date`, sensors may cover fewer chargers than `n_chargers`, converted files live in `backend/data/`; new `GET /api/reports/categories` and `report_categories.json` for the pie chart | |
| 2026-10-10 | v0.4 driver reports: new issue type `user_reported`, charger actions sorted by `report_count`, new `Action.report_count` and `Action.first_reported_at`, optional `user_reports.parquet`; festive = `is_holiday` only | |
| 2026-10-10 | v0.3 data is US (ACN): station local time, USD, US holidays; added `meta.currency`, `meta.json`, optional `arrivals_actual` | |
| 2026-10-10 | v0.2 renamed to AmpWise; added demo reset, scenarios endpoints, Firestore section (no login) | |
| 2026-10-10 | v0.1 first draft | |
