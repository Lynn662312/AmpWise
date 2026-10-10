# AmpWise API Contract 

> Lives at `AmpWise/docs/api_contract.md`.
> This is the single source of truth between backend, frontend and ML.
> Change this file first (and tell the team), then change code.

Version: v0.2 · 2026-10-10

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
  time_range: { start: string; end: string };
  festive_periods: { name: string; start: string; end: string }[];
  demo_times: { label: string; time: string }[];   // preset slider points
  assumptions: { rm_per_session: number; max_tolerable_wait_min: number; avg_charge_min: number };
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
  rm_at_risk: number;
  deadline: string | null;
  urgency: Urgency;
  reason: string;                  // template sentence, always present, no AI
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
  before_revenue_rm: number;
  after_revenue_rm: number;
  summary: string;
}

interface BacktestResult {
  week_label: string;
  queue_minutes_saved: number;
  rm_protected: number;
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
  "assumptions": { "rm_per_session": 35.0, "max_tolerable_wait_min": 45, "avg_charge_min": 38 }
}
```

(Dates and RM values above are placeholders until the team confirms them.)

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

`limit` default 20. Sorted: `safety_fault` first, then `rm_at_risk` descending. Response `200`: `Action[]`

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

### ★ GET `/api/backtest?week=`

`week` default `"raya_2026"`. Response `200`: `BacktestResult`

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
| `fault_labels.parquet` | charger_id, fault_type, start_date | ML 2 |
| `params.json` | avg_charge_min, rm_per_session, max_tolerable_wait_min | ML 1 + team |

Dummy versions with the right columns are due by hour 3.

---

## 6. Firestore (no login) / 数据库（不做登录）

Only the **backend** touches Firestore (Admin SDK). The frontend never reads or writes Firestore directly.

| Collection | Doc id | Fields | Why |
| --- | --- | --- | --- |
| `actions_status` | action id | state, updated_at | Mark assigned / done |
| `scenarios` | auto | name, request, result, created_at | Saved what-if runs |
| `advice_cache` | `{action_id}|{time}|{language}` | Advice + created_at | Survives server restarts (free hosting sleeps) |

Model outputs (forecasts, health) are **not** stored in Firestore — they stay in parquet, loaded into memory.

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
| backend | `DATA_DIR` | `../ml/outputs` |
| backend | `CORS_ORIGINS` | `http://localhost:5173,https://ampwise.vercel.app` |
| backend | `LLM_API_KEY` | (secret, never commit) |
| backend | `LLM_MODEL` | provider's model name |
| backend | `FIREBASE_CREDENTIALS` | path or JSON of service account (secret) |
| frontend | `VITE_API_BASE_URL` | `http://localhost:8000/api` |
| frontend | `VITE_FIREBASE_*` | Firebase web config (public, OK in frontend) |

---

## 8. Change log / 修改记录

| Date | Change | By |
| --- | --- | --- |
| 2026-10-10 | v0.2 renamed to AmpWise; added demo reset, scenarios endpoints, Firestore section (no login) | |
| 2026-10-10 | v0.1 first draft | |
