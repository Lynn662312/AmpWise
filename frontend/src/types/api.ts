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
  assumptions: { rm_per_session: number; max_tolerable_wait_min: number; avg_charge_min: number }
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
  predicted_wait_min: number
  level: "green" | "amber" | "red"
  open_issue_count: number
}

export type ApiForecastSlot = {
  slot_start: string
  arrivals: number
  arrivals_baseline: number
  wait_min: number
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

export type ApiBacktestResult = BacktestResult
