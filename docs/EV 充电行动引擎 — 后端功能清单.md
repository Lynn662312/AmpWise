# AmpWise — 开发清单 / Build Checklist

Oct 10, 2026 · @lynn

## 总览与分工 / Overview & roles

**ML 负责"预测"，后端负责"决策"和"提供数据"。** ML 只交付模型文件和固定签名的推理函数；排队计算、优先级、解释文字、what-if、回测都在后端。

**ML predicts; the backend decides and serves.** ML ships model files plus inference functions with fixed signatures. Queueing, priority scoring, explanations, what-if and backtest all live in the backend.

| 角色 Role | 负责 Owns | 主要目录 Main folder |
| --- | --- | --- |
| 后端 Backend | API、排队公式、优先级、问题分类、解释、what-if、回测、mock 数据 / API, queueing, priority, classification, explanations, what-if, backtest, mock data | `backend/app/` |
| 前端 Frontend | 地图、行动清单、充电桩详情、what-if 面板、结果页 / Map, action list, charger detail, what-if panel, results page | `frontend/src/` |
| ML 1：拥堵 Congestion | 数据清洗、按 30 分钟聚合、马来西亚适配、LightGBM / Data cleaning, 30-min aggregation, Malaysia adaptation, LightGBM | `ml/src/`, `ml/notebooks/colab/` |
| ML 2：健康 Health | 故障注入、健康特征、规则检测、故障分类、precision/recall / Fault injection, health features, rule detector, fault types, precision/recall | `ml/src/`, `ml/notebooks/colab/` |

接口字段、例子、环境变量以 `docs/api_contract.md` 为准，改字段先改它。/ Field names, examples and env vars follow `docs/api_contract.md`; change that file before changing code.

## Firebase 用途 / What Firebase is for

建议：**Firebase 只放"人会改的数据"，模型结果不放 Firestore。** 预测和健康结果是 parquet，后端启动时读进内存，速度快、不花钱、演示稳定。

Recommendation: **Firebase holds only data people change; model outputs stay out of Firestore.** Forecasts and health results are parquet files loaded into memory at startup: fast, free and stable for the demo.

| 用途 Use | 放哪里 Where | 必须 Required |
| --- | --- | --- |
| 运营人员登录 / Operator login | Firebase Auth（Google 登录 / Google sign-in） | 可选 Optional |
| 行动状态：已指派、已完成 / Action status: assigned, done | Firestore `actions_status/{action_id}` | 推荐 Recommended |
| 保存的 what-if 场景 / Saved what-if scenarios | Firestore `scenarios/{id}` | 可选 Optional |
| 预测、健康结果 / Forecasts, health results | `ml/models/exported/` + parquet，**不进 Firestore / not in Firestore** | — |

行动状态让演示更真实：评委点"Mark done"，充电桩恢复，等待时间立刻下降。

Action status makes the demo feel real: a judge clicks "Mark done", the charger returns to service, and the predicted wait drops immediately.

## 后端函数（按目录）/ Backend functions by folder

★ = 演示必须有 / required for the demo。没有 ★ 的时间不够可以砍 / Items without ★ can be cut.

**`app/services/data_loader.py` — 数据加载 / Data loading**（启动时读一次 / loaded once at startup）

| 函数 Function | 作用 Purpose |
| --- | --- |
| ★ `load_stations()` | 走廊上的充电站：id、名称、经纬度、桩数、功率 / Corridor stations: id, name, lat/lon, charger count, power |
| ★ `load_forecasts()` | 读 ML 1 的到达量预测 / Load ML 1 arrival forecasts |
| ★ `load_health()` | 读 ML 2 的充电桩健康结果 / Load ML 2 charger health results |
| `load_holidays()` | 节假日日历 / Holiday calendar |
| `fetch_weather(lat, lon, start, end)` | Open-Meteo，结果缓存 / Open-Meteo, cached |

**`app/services/queueing.py` — 排队计算 / Queueing**

| 函数 Function | 作用 Purpose |
| --- | --- |
| ★ `erlang_c(lam, mu, c)` | M/M/c：需要排队的概率 / probability of waiting |
| ★ `predict_wait(arrivals, avg_charge_min, working_chargers)` | 到达量 → 预计等待分钟 / arrivals → expected wait (min) |
| ★ `lost_sessions(arrivals, wait_min, max_tolerable_min)` | 等太久离开的车数 / cars that give up waiting |

**`app/services/classifier.py` — 问题分类 / Issue classification**

| 函数 Function | 作用 Purpose |
| --- | --- |
| ★ `classify_station(station_id, time)` | 短期拥堵 / 长期容量不足 / 使用率低 — congestion / chronic under-capacity / underused |
| ★ `classify_charger(charger_id, time)` | 安全故障 / 衰退 / 接口故障 / 正常 — safety / degraded / connector / healthy（用 ML 2 结果 / from ML 2） |

**`app/services/priority.py` — 优先级 / Priority**

| 函数 Function | 作用 Purpose |
| --- | --- |
| ★ `score_issue(issue)` | P(故障) × 高峰前损失会话 × 每次 RM；安全故障置顶 / P(fault) × lost sessions before peak × RM; safety always first |
| ★ `build_action_list(time, limit)` | 汇总、打分、排序 / collect, score, rank |
| `recommend_action(issue_type)` | 问题类型 → 建议动作 / issue type → recommended action |

**`app/services/explain.py` — 解释 / Explanations**

| 函数 Function | 作用 Purpose |
| --- | --- |
| ★ `make_reason(action)` | 模板生成一句话 / one templated sentence, e.g. "Fix Charger 3 at Seremban R&R by Thursday…" |

**`app/services/whatif.py` — 假设分析 / What-if**

| 函数 Function | 作用 Purpose |
| --- | --- |
| ★ `simulate_fix(charger_id, fix_time)` | 现在修 vs 节后修 / fix now vs after the holiday |
| `simulate_add_chargers(station_id, n)` | 加 n 个桩 / add n chargers |
| `simulate_discount(station_id, pct, slots)` | 非高峰折扣 / off-peak discount |

**`app/services/backtest.py` — 回测 / Backtest**

| 函数 Function | 作用 Purpose |
| --- | --- |
| ★ `run_baseline(week)` | 按报修顺序修 + 去最近站 / fix in report order + nearest station |
| ★ `run_ours(week)` | 按优先级修 + 引导分流 / fix by priority + reroute |
| ★ `compare(baseline, ours)` | 节省分钟、保住 RM、MAE、precision/recall / minutes saved, RM protected, MAE, precision/recall |

**`app/services/llm.py` — AI 建议 / AI advice**（只解释、给步骤，不决定排序和数字 / explains and suggests steps only; never decides ranking or numbers）

| 函数 Function | 作用 Purpose |
| --- | --- |
| ★ `build_facts(action, time)` | 把行动、健康证据、预测打包成固定 JSON / pack action + health evidence + forecast into a fixed JSON |
| ★ `generate_advice(facts, language)` | 调 AI API，返回 summary、steps、caveats；8 秒超时 / call the AI API, return summary, steps, caveats; 8 s timeout |
| ★ `fallback_advice(facts)` | AI 失败时用模板 / template fallback when the AI fails |
| `check_numbers(advice, facts)` | 检查 AI 没编造数字 / reject advice containing numbers not in the facts |
| ★ `get_advice(action_id, time, language)` | 先查缓存，再调用；演示前预热缓存 / cache first, then call; pre-warm before the demo |

**其他目录 / Other folders**

| 文件 File | 内容 Contents |
| --- | --- |
| ★ `app/schemas/*.py` | Pydantic：`Station`, `ForecastSlot`, `ChargerHealth`, `Action`, `WhatIfRequest`, `WhatIfResult`, `BacktestResult` |
| ★ `app/api/routes/*.py` | 每组接口一个文件 / one file per endpoint group（见下节 / see next section） |
| ★ `app/core/config.py` | 数据路径、`params.json`、CORS 来源 / data paths, `params.json`, CORS origins |
| `app/core/security.py` | 验证 Firebase ID token（如果做登录）/ verify Firebase ID token (if login is used) |
| `app/firebase/client.py` | Firebase Admin 初始化 + 读写 `actions_status` / Admin SDK init + read/write `actions_status` |
| ★ `app/utils/mock_data.py` | 假数据，让前端第一天就能接 / mock data so the frontend can start on day one |
| `app/models/` | 黑客松不需要 ORM，可以留空 / no ORM needed; can stay empty |

## API 接口 / API endpoints

所有接口带 `time` 参数（演示用的模拟当前时间），前端时间滑块改的就是它。

Every endpoint takes a `time` parameter (the simulated "now" for the demo); the frontend time slider changes it.

| 方法 Method | 路径 Path | 用途 Purpose | 路由文件 Route file | 前端页面 Page | 必须 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/meta` | 走廊、时间范围、节日日期 / corridor, time range, festive dates | `meta.py` | 全局 Global | ★ |
| GET | `/api/stations?time=` | 站点 + 预计等待 + 颜色 / stations + predicted wait + colour | `stations.py` | 地图 Map | ★ |
| GET | `/api/stations/{id}/forecast` | 未来 N 小时每 30 分钟预测 / next N hours, per 30 min | `stations.py` | 站点详情 Station detail | ★ |
| GET | `/api/chargers/{id}/health` | 功率比曲线、状态、证据 / power-ratio series, status, evidence | `chargers.py` | 充电桩详情 Charger detail | ★ |
| GET | `/api/actions?time=&limit=` | 排序后的行动清单 / ranked action list | `actions.py` | 行动清单 Actions | ★ |
| PATCH | `/api/actions/{id}/status` | 标记已指派/已完成，写 Firestore / mark assigned/done, writes Firestore | `actions.py` | 行动清单 Actions |  |
| POST | `/api/whatif` | 场景前后对比 / before vs after for a scenario | `whatif.py` | What-if | ★ |
| GET | `/api/backtest?week=` | 基线 vs 我们 / baseline vs ours | `backtest.py` | 结果 Results | ★ |
| GET | `/api/health` | 服务在线检查 / liveness check | `meta.py` | — |  |
| POST | /api/actions/{id}/advice | AI 生成建议和步骤（点开某条才调用）/ AI advice and steps, called when a row is expanded | actions.py | 行动清单 Actions | ★ |

`main.py` 要加 `CORSMiddleware`，允许 `http://localhost:5173` 和部署后的前端域名。

Add `CORSMiddleware` in `main.py` for `http://localhost:5173` and the deployed frontend domain.

## ML 交付约定 / ML hand-off contract

**签名今天定下来，之后不要改。** 后端通过 `ml/src/inference/` 调用，不关心 Colab 里怎么训练。

**Fix these signatures today and don't change them.** The backend calls `ml/src/inference/` and doesn't care how training happens in Colab.

```python
# ml/src/inference/congestion.py  —— ML 1
def predict_arrivals(station_id: str, start: datetime, n_slots: int) -> pd.DataFrame:
    """columns: slot_start, arrivals, arrivals_baseline, is_festive"""

# ml/src/inference/health.py  —— ML 2
def assess_chargers(as_of: datetime) -> pd.DataFrame:
    """columns: charger_id, station_id, status, p_fault, evidence"""
```

| 交付物 Deliverable | 位置 Location | 负责 Owner |
| --- | --- | --- |
| 训练好的模型 / Trained model | `ml/models/exported/congestion.pkl` | ML 1 |
| 预先算好的预测 / Precomputed forecasts | `forecasts.parquet`: station\_id, slot\_start, arrivals, arrivals\_baseline, is\_festive | ML 1 |
| 参数 / Parameters | `ml/configs/params.json`: 平均充电时长、每次 RM、容忍等待分钟 / avg charge time, RM per session, max tolerable wait | ML 1（RM 由团队定 / RM set by team） |
| 健康结果 / Health results | `health.parquet`: charger\_id, date, power\_ratio, baseline, status, p\_fault | ML 2 |
| 故障真实答案 / Fault ground truth | `fault_labels.parquet`: charger\_id, fault\_type, start\_date | ML 2 |
| 预处理 / Preprocessing | `ml/src/preprocessing/`，训练和推理用同一份 / same code for training and inference | ML 1 + ML 2 |
| 小样本 / Small samples | `ml/sample_data/`，后端测试用 / for backend tests | ML 1 + ML 2 |

统一约定 / Conventions：时间用 ISO、UTC+8、30 分钟时段 / ISO timestamps, UTC+8, 30-min slots；站点 `stn_001`，充电桩 `stn_001_c1`。

**第 3 小时前先交一份格式正确的假 parquet**，后端可以先接上。/ **Ship a correctly formatted dummy parquet by hour 3** so the backend can wire it up early.

## 后端待办清单 / Backend to-do checklist

按顺序做，时间按约 24 小时估。/ Work top to bottom; hours assume a \~24-hour build.

**阶段 1：先让前端能动（0–3h）/ Phase 1: unblock the frontend**

- [x] `main.py`：FastAPI app、CORS、挂载 routers / FastAPI app, CORS, mount routers — **已完成 Done**
- [x] `app/core/config.py`：数据路径、`params.json`、CORS 来源 / data paths, params, CORS origins — **已完成 Done**（`params.json` 在阶段 2 读取 / `params.json` is read in Phase 2）
- [x] `app/schemas/`：全部 Pydantic 模型，发给前端 / all Pydantic models, share with frontend — **已完成 Done**
- [x] `app/utils/mock_data.py`：每个接口的假数据 / mock data for every endpoint — **已完成 Done**
- [x] 所有 ★ 接口先返回 mock，`/docs` 能打开 / all ★ endpoints return mock data, `/docs` works — **已完成 Done**

**阶段 2：计算核心（3–8h）/ Phase 2: core logic**

- [x] `queueing.py`：`erlang_c`、`predict_wait`、`lost_sessions` — **已完成 Done**
- [x] 写单元测试：已知输入 → 已知等待时间 / unit tests in `tests/`: known inputs → known waits — **已完成 Done**
- [x] `classifier.py`：`classify_station`、`classify_charger` — **已完成 Done**
- [x] `data_loader.py`：先读 ML 的假 parquet / load ML's dummy parquet first — **已完成 Done**（假数据由 `backend/scripts/make_dummy_data.py` 生成 / dummy files come from `backend/scripts/make_dummy_data.py`）

**阶段 3：行动清单（8–14h）/ Phase 3: action list**

- [x] `priority.py`：`score_issue`、`build_action_list`，安全故障置顶 / safety faults always first — **已完成 Done**
- [x] `explain.py`：`make_reason` 模板 / templates — **已完成 Done**
- [x] `/api/actions`、`/api/stations`、`/api/chargers/{id}/health` 换成真实数据 / switch to real data — **已完成 Done**（目前读假 parquet；`/api/meta` 和 forecast 也已接上 / reads the dummy parquet for now; `/api/meta` and forecast are wired too）
- [x] 检查：`/api/actions` 1 秒内返回 / check `/api/actions` responds in under 1 s — **已完成 Done**

**阶段 3b：AI 建议（12–16h）/ Phase 3b: AI advice**

- [ ] `.env` 加 `LLM_API_KEY`、`LLM_MODEL`，确认 `.gitignore` 包含 `.env` / add keys to `.env`, make sure `.env` is git-ignored — **待办 To do**：`.env` 已被 git 忽略，还需要填入真实的 key / `.env` is git-ignored; a real key still has to be added
- [x] `llm.py`：`build_facts`、`generate_advice`、`fallback_advice`、`get_advice` — **已完成 Done**（未用真实 key 测试 / not yet tested with a real key）
- [x] `POST /api/actions/{id}/advice` 接上，AI 失败时返回模板（仍是 200）/ wire up; template fallback on failure, still 200 — **已完成 Done**
- [ ] 演示前对 `demo_times` 预热缓存 / pre-warm the cache for `demo_times` before the demo — **脚本已写好 Script ready**：`python -m scripts.prewarm_advice`，演示前运行 / run it before the demo

**阶段 4：证明效果（14–20h）/ Phase 4: prove it**

- [ ] `whatif.py`：`simulate_fix`（必须 / required），加桩、折扣（可选 / optional）
- [ ] `backtest.py`：`run_baseline`、`run_ours`、`compare`
- [ ] `/api/whatif`、`/api/backtest` 接上 / wire up
- [ ] 把回测数字交给做 slides 的人 / hand backtest numbers to whoever makes slides

**阶段 5：收尾（20–24h）/ Phase 5: wrap up**

- [ ] （可选）`app/firebase/`：`actions_status` 读写 + `PATCH /api/actions/{id}/status` / (optional) Firestore action status
- [ ] 部署到 Render，环境变量放 Firebase 凭证 / deploy to Render, Firebase credentials in env vars
- [ ] 和前端一起跑完整演示两次 / run the full demo twice with the frontend

## 前端待办清单 / Frontend to-do checklist

推荐库 / Libraries：`react-leaflet`（地图 map）、`recharts`（图表 charts）、`@tanstack/react-query`（请求和缓存 fetching + caching）。先接 mock，后端真实数据好了再切。/ Build against mock data first; switch when real data is ready.

**阶段 1：搭架子（0–3h）/ Phase 1: scaffolding**

- [ ] `routes/`：5 个页面路由 / routes for 5 pages — Map, Actions, ChargerDetail, WhatIf, Results
- [ ] `layouts/`：侧边栏 + 顶部时间滑块 / sidebar + top time slider
- [ ] `context/TimeContext`：全局"模拟当前时间" / global simulated "now"
- [ ] `services/api.ts`：每个后端接口一个函数，`baseURL` 用环境变量 / one function per endpoint, `baseURL` from env var
- [ ] `utils/types.ts`：照 `app/schemas` 写 TypeScript 类型 / TypeScript types mirroring `app/schemas`

**阶段 2：核心页面（3–12h）/ Phase 2: core pages**

- [ ] `pages/Map`：站点按预计等待上色（绿/黄/红），点击看详情 / stations coloured by wait (green/amber/red), click for detail
- [ ] `pages/Actions`：行动清单表格，显示类型、RM、截止时间、一句话原因；安全故障红色置顶 / action table with type, RM, deadline, reason; safety faults red at top
- [ ] `components/IssueBadge`：5 种问题类型的标签 / badge for the issue types
- [ ] `hooks/useActions`、`useStations`：react-query 封装 / react-query hooks
- [ ] 时间滑块拖到节日高峰，地图和清单一起变化 / dragging the slider to the festive peak updates map and list together

**阶段 3：详情和证明（12–20h）/ Phase 3: detail and proof**

- [ ] `pages/ChargerDetail`：功率比折线 vs 7 天基线，标出衰退开始点 / power-ratio line vs 7-day baseline, mark where it degraded
- [ ] `pages/WhatIf`：选"现在修 / 节后修"，显示前后等待和收入 / fix now vs later, before/after wait and revenue
- [ ] `pages/Results`：回测大数字卡片（节省分钟、保住 RM、precision）/ backtest headline cards (minutes saved, RM protected, precision)
- [ ] 加载中和报错状态 / loading and error states

**AI 建议 / AI advice**

- [ ] `components/AdvicePanel`：行动清单某条展开时调用 `/advice`，显示 summary、步骤、注意事项 / on row expand, call `/advice` and show summary, steps, caveats
- [ ] 显示来源标签 "AI" 或 "Template"，加载中显示骨架屏 / show an "AI" or "Template" source tag and a loading skeleton
- [ ] 语言切换 EN / 中文 / BM，传给 `language` 参数 / language toggle passed as `language`

**阶段 4：收尾（20–24h）/ Phase 4: wrap up**

- [ ] （可选）`services/firebase.ts`：Google 登录 + "Mark done" 按钮 / (optional) Google sign-in + "Mark done" button
- [ ] `styles/`：统一配色，演示用的投影仪上看得清 / consistent colours, readable on a projector
- [ ] 部署到 Vercel，设置后端 URL 环境变量 / deploy to Vercel with backend URL env var
- [ ] 按演示脚本走一遍，去掉多余点击 / walk the demo script, remove extra clicks

## 待确认问题 / Open questions

- [ ] 走廊选 KL–Penang 还是 KL–JB？/ Which corridor: KL–Penang or KL–JB?
- [ ] "等太久离开"阈值多少分钟？建议 45，标明是假设 / Max tolerable wait? Suggest 45 min, labelled as an assumption
- [ ] 每次充电收入假设多少 RM？/ Assumed RM per charging session?
- [ ] 做不做登录和 "Mark done"？建议时间够才做 / Build login and "Mark done"? Only if time allows
- [ ] 预测预先算好还是实时调模型？建议预先算好，演示更稳 / Precompute forecasts or call the model live? Suggest precompute for a stable demo
