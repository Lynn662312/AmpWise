export const stationChargerDiscoveryNote = {
  title: "Backend discovery requirement",
  detail: "v0.2 does not expose a station-to-charger discovery endpoint. API mode must receive a verified charger_id and station_id relationship from the backend or a future charger registry endpoint; the frontend must not derive charger IDs from n_chargers.",
} as const

export const actionCapabilityNote = {
  title: "Action Center backend capabilities",
  detail: "AI advice requires POST /api/actions/{action_id}/advice with time and language. Persistent action state requires PATCH /api/actions/{action_id}/status and is disabled unless VITE_ACTION_STATUS_ENABLED=true.",
} as const

export const whatIfCapabilityNote = {
  title: "What-if backend limitation",
  detail: "v0.2 supports scenario=fix_now but has no repair-date or delayed-repair request field. The after_peak comparison remains mock-only and is never sent to POST /api/whatif.",
} as const

export const backendHandoffChecklist = [
  { capability: "Real ML evaluation", endpoint: "GET /api/meta and all data endpoints", parameters: "MOCK=0 backend configuration", response: "Production station, action, forecast, health and backtest fields matching v0.2", status: "Frontend API mode is typed; live ML responses not verified", page: "All routes", priority: "required", proposal: "Confirm deployment configuration and representative fixtures." },
  { capability: "California region", endpoint: "GET /api/stations?time=", parameters: "time ISO 8601 +08:00; no region parameter in v0.2", response: "Station records with region or a documented region source", status: "Local JSON supports California; API mode currently labels contract stations Malaysia", page: "/map", priority: "optional", proposal: "Add region to station response or define a region metadata endpoint." },
  { capability: "Station charger discovery", endpoint: "Not defined", parameters: "station_id", response: "charger_id plus station_id relationship and available specifications", status: "Frontend does not guess charger IDs; API page needs a verified registry", page: "Station Detail, Charger Health, What-if", priority: "required", proposal: "GET /api/stations/{station_id}/chargers." },
  { capability: "AI advice", endpoint: "POST /api/actions/{action_id}/advice", parameters: "Body { time, language: en|zh|ms }", response: "action_id, summary, steps, caveats, source, cached", status: "Explicit UI request wired; live route not verified", page: "Action Center", priority: "required", proposal: "No contract change; deploy and verify route." },
  { capability: "Action status persistence", endpoint: "PATCH /api/actions/{action_id}/status", parameters: "Body { state: assigned|done }", response: "Updated Action", status: "Feature gated by VITE_ACTION_STATUS_ENABLED", page: "Action Center", priority: "optional", proposal: "No contract change; enable only after route verification." },
  { capability: "Notification events", endpoint: "Not defined", parameters: "Stable action id or event id", response: "Critical safety event stream or polling payload", status: "Frontend derives critical safety alerts from the actions query; no event endpoint", page: "Global notification bell", priority: "optional", proposal: "GET /api/notifications or SSE/WebSocket event contract." },
  { capability: "Sessions and uptime", endpoint: "Not defined", parameters: "Optional time range", response: "Session records and network uptime aggregates", status: "Sessions dashboard remains local-data only", page: "/sessions and Overview", priority: "required", proposal: "GET /api/sessions and GET /api/network/status." },
  { capability: "Delayed repair simulation", endpoint: "POST /api/whatif", parameters: "Current v0.2 request has scenario and time but no repair date", response: "Before/after wait and revenue plus summary", status: "after_peak is mock-only and stripped from API requests", page: "/what-if", priority: "optional", proposal: "Add repair_time or repair_offset when backend calculation is agreed." },
  { capability: "Saved scenarios", endpoint: "GET/POST /api/scenarios", parameters: "Not defined in v0.2 core contract", response: "Scenario id, inputs, owner/session, timestamps", status: "Not enabled; no Firestore calls from frontend", page: "/what-if and Presentation Mode", priority: "optional", proposal: "Define scenario persistence contract before enabling UI." },
  { capability: "Demo reset", endpoint: "POST /api/demo/reset", parameters: "Body { clear_scenarios?: boolean }", response: "cleared_actions and cleared_scenarios", status: "Not wired", page: "Presentation Mode", priority: "optional", proposal: "Enable after backend route and authorization behavior are confirmed." },
  { capability: "Backtest coverage", endpoint: "GET /api/backtest?week=", parameters: "week evaluation identifier", response: "week_label, daily[], impact and model metrics", status: "Frontend renders daily[]; live week coverage not verified", page: "/results", priority: "required", proposal: "Publish supported evaluation weeks through meta or a documented registry." },
  { capability: "Production CORS and API URL", endpoint: "All /api routes", parameters: "VITE_API_BASE_URL", response: "CORS-enabled JSON responses", status: "Local default is http://localhost:8000/api; production origin unverified", page: "All routes", priority: "required", proposal: "Configure allowed frontend origins and deployment-specific VITE_API_BASE_URL." },
] as const
