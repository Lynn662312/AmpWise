import type { Action, ActionState } from "@/features/actions/types"
import type { BacktestResult } from "@/features/results/types"

export type ApiSource = "api" | "mock"

export type ApiTimeRange = {
  start: string
  end: string
  step_minutes?: number
}

export type ApiMeta = {
  corridor_name: string
  timezone?: string
  currency: string
  time_range: ApiTimeRange
  festive_periods: { name: string; start: string; end: string }[]
  demo_times: { label: string; time: string }[]
  backtest_weeks?: { value: string; label: string }[]
  assumptions: { rm_per_session: number; avg_charge_min: number }
}

export type ApiHealth = {
  status: string
  service?: string
  version?: string
  [key: string]: unknown
}

export type ApiStation = {
  id: string
  name: string
  lat: number
  lon: number
  n_chargers: number
  n_working: number
  power_kw: number
  predicted_wait_min: number | null
  level: "green" | "amber" | "red"
  open_issue_count: number
}

export type ApiForecastSlot = {
  slot_start: string
  arrivals: number
  arrivals_baseline: number
  wait_min: number | null
  is_festive: boolean
}

export type ApiPowerRatioPoint = {
  date: string
  ratio: number
  baseline: number
}

export type ApiAction = Action & {
  id: string
  station_name: string
  state: ActionState
  report_count: number
  first_reported_at: string | null
}

export type ApiChargerHealth = {
  charger_id: string
  station_id: string
  status: "healthy" | "degraded" | "connector_fault" | "safety_fault"
  p_fault: number
  evidence: string[]
  series: ApiPowerRatioPoint[]
  degraded_since: string | null
}

export type ApiChargerEvent = {
  time: string
  source: "sensor" | "driver"
  message: string
}

export type ApiStationCharger = {
  charger_id: string
  station_id: string
  power_kw: number
  status: ApiChargerHealth["status"]
}

export type ApiBacktestResult = BacktestResult

export type ApiReportCategory = {
  category: string
  count: number
  percentage: number
}

export type ApiOverview = {
  data_source: "placeholder" | "api"
  energy_delivered_kwh: number
  energy_delivered_week_kwh: number
  live_sessions: number
  network_uptime_pct: number
  energy_trend: { date: string; kwh: number }[]
}
