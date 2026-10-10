import type { Action, ActionState } from "@/features/actions/types"
import type { ChargingStation, StationLevel } from "@/features/map/types"
import type { ChargerHealth } from "@/features/chargers/types"
import type { BacktestResult, EvaluationWeek } from "@/features/results/types"
import type { RepairTiming, WhatIfRequest, WhatIfResult } from "@/features/what-if/types"
import stationsData from "@/data/stations.json"
import forecastProfiles from "@/data/forecasts.json"
import chargerOverrides from "@/data/chargers.json"
import actionsData from "@/data/actions.json"
import backtestData from "@/data/backtest-results.json"
import healthProfiles from "@/data/charger-health.json"
import whatIfRules from "@/data/whatif-results.json"
import demoScenarios from "@/data/demo-scenarios.json"
import metaData from "@/data/meta.json"
import sessionsData from "@/data/sessions.json"
import reportCategoriesData from "@/data/feedback.json"
import { regions, type RegionId } from "@/features/map/config/regions"
import type { ApiMeta } from "@/types/api"
import type { ApiOverview } from "@/types/api"

type StationSeed = { id: string; name: string; region: string; lat: number; lon: number; location?: string; n_chargers?: number; n_working?: number; power_kw?: number }
type ForecastProfile = { station_id: string; base_wait_min: number; time_amplitude_min: number; next_hour_offset_min: number; later_hour_offset_min: number; festive?: boolean }
type ChargerOverride = { charger_id: string; station_id: string; status: "degraded" | "offline" }
type ActionSeed = Omit<Action, "station_name" | "state"> & { station_name?: string; state?: ActionState }
type HealthProfile = typeof healthProfiles.working
export type MockCharger = { id: string; station_id: string; power_kw: number; status: "working" | "degraded" | "offline" }
export type MockSimulationInput = WhatIfRequest & { repair_timing?: RepairTiming }
export type MockStationSeed = Omit<ChargingStation, "forecast" | "predicted_wait_min" | "level"> & { baseWait: number | null }
export type MockMeta = typeof metaData
export type MockDemoScenario = typeof demoScenarios[number]
export type MockDashboardData = {
  energy_trend: { day: string; energy: number }[]
  overview_stations: { station_id: string; status: string; ports: string; load: string; tone: string }[]
  summary: { energy_delivered_kwh: number; active_stations: number; total_stations: number; live_sessions: number; network_uptime_pct: number; weekly_energy_kwh: number }
}

const storageKey = "ampwise-map-stations"

function readSeeds(): MockStationSeed[] {
  const canonical = (stationsData as StationSeed[]).map((station) => ({ ...station, location: station.location ?? null, n_chargers: station.n_chargers ?? null, n_working: station.n_working ?? null, power_kw: station.power_kw ?? null, baseWait: getProfile(station.id)?.base_wait_min ?? null })) as MockStationSeed[]
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(storageKey)
    if (saved) {
      try {
        const savedStations = JSON.parse(saved) as MockStationSeed[]
        const savedById = new Map(savedStations.map((station) => [station.id, station]))
        return canonical.map((station) => ({ ...station, ...savedById.get(station.id), region: station.region }))
      } catch { window.localStorage.removeItem(storageKey) }
    }
  }
  return canonical
}

function getProfile(stationId: string): ForecastProfile | null {
  return (forecastProfiles as ForecastProfile[]).find((profile) => profile.station_id === stationId) ?? null
}

function getLevel(wait: number | null, working: number): StationLevel {
  if (!working || wait === null) return "unavailable"
  if (wait >= 25) return "high"
  if (wait >= 15) return "moderate"
  return "low"
}

function forecastValue(baseWait: number, timeMinutes: number, amplitude: number) {
  return Math.max(2, Math.round(baseWait + Math.sin(((timeMinutes - 480) / 720) * Math.PI * 2) * amplitude))
}

export function getMapSeedData() {
  return { source: metaData.source, corridor: metaData.corridor, stations: readSeeds() }
}

export function saveMapSeed(station: MockStationSeed) {
  const nextStations = [...readSeeds().filter(({ id }) => id !== station.id), station]
  window.localStorage.setItem(storageKey, JSON.stringify(nextStations))
  return station
}

export function getMockStations(timeMinutes: number): ChargingStation[] {
  return readSeeds().map(({ baseWait, ...station }) => {
    const profile = getProfile(station.id)
    const operational = station.n_chargers !== null && station.n_working !== null && station.power_kw !== null && profile !== null
    const predictedWait = operational && station.n_working ? forecastValue(profile.base_wait_min, timeMinutes, profile.time_amplitude_min) : null
    const nextWait = operational && station.n_working ? Math.max(2, (predictedWait ?? 0) + profile.next_hour_offset_min) : null
    const laterWait = operational && station.n_working ? Math.max(2, (predictedWait ?? 0) + profile.later_hour_offset_min) : null
    return {
      ...station,
      predicted_wait_min: predictedWait,
      level: getLevel(predictedWait, station.n_working ?? 0),
      forecast: [
        ...(operational ? [
          { time: "Now", arrivals: null, predicted_wait_min: predictedWait, arrivals_baseline: null, level: getLevel(predictedWait, station.n_working ?? 0), is_festive: false },
          { time: "+1h", arrivals: null, predicted_wait_min: nextWait, arrivals_baseline: null, level: getLevel(nextWait, station.n_working ?? 0), is_festive: false },
          { time: "+2h", arrivals: null, predicted_wait_min: laterWait, arrivals_baseline: null, level: getLevel(laterWait, station.n_working ?? 0), is_festive: false },
        ] : []),
      ],
    }
  })
}

export function getMockChargers(station: ChargingStation | null): MockCharger[] {
  if (!station || station.n_chargers === null || station.n_working === null || station.power_kw === null) return []
  const nChargers = station.n_chargers
  const nWorking = station.n_working
  const powerKw = station.power_kw
  return Array.from({ length: station.n_chargers }, (_, index) => {
    const number = index + 1
    const id = `${station.id}_c${number}`
    const override = (chargerOverrides as ChargerOverride[]).find((charger) => charger.charger_id === id)
    const status: MockCharger["status"] = override?.status === "degraded" || override?.status === "offline" ? override.status : number > nWorking ? "offline" : "working"
    return { id, station_id: station.id, power_kw: Math.round(powerKw / Math.max(1, nChargers / 4)), status }
  })
}

export function getMockActions(): Action[] {
  return (actionsData as ActionSeed[]).map((action) => ({
    ...action,
    id: action.id ?? `action_${action.rank}_${action.station_id}`,
    station_name: action.station_name ?? stationsData.find((station) => station.id === action.station_id)?.name ?? action.station_id,
    state: action.state ?? "open",
  }))
}

export function getMockChargerHealth(chargerId: string, station: ChargingStation | null, days: number): ChargerHealth {
  const charger = getMockChargers(station).find(({ id }) => id === chargerId)
  const profileName = charger?.status === "degraded" || charger?.status === "offline" ? "degraded" : "working"
  const profile = healthProfiles[profileName] as HealthProfile
  const series = Array.from({ length: Math.max(1, Math.min(days, 14)) }, (_, index) => {
    const actual = Math.max(0, profile.actual_start + index * profile.actual_step)
    const fault = Math.max(0, profile.fault_start + index * profile.fault_step + (profileName === "working" ? (index % 2) * 0.02 : 0))
    return { time: `Day ${index + 1}`, actual_power_ratio: Number(actual.toFixed(2)), baseline_power_ratio: 1, fault_probability: Number(fault.toFixed(2)) }
  })
  const status = charger?.status === "working" ? "healthy" : charger?.status === "degraded" ? "degraded" : charger?.status === "offline" ? "safety_fault" : "unknown"
  return { charger_id: chargerId, station_id: station?.id ?? "", status, p_fault: series.at(-1)?.fault_probability ?? null, evidence: [], degraded_since: charger?.status === "degraded" ? series[0]?.time ?? null : null, series }
}

export function getMockBacktest(week: string): BacktestResult | null {
  const result = (backtestData.results as Record<string, Omit<BacktestResult, "week_label">>)[week]
  const label = backtestData.weeks.find((item) => item.value === week)?.label ?? week
  return result ? { ...result, week_label: label } : null
}
export function getEvaluationWeeks(): readonly EvaluationWeek[] { return backtestData.weeks }
export function getMockMeta(): ApiMeta { return { corridor_name: metaData.corridor_name, timezone: metaData.timezone, currency: metaData.currency, time_range: metaData.time_range, demo_times: metaData.demo_times, festive_periods: metaData.festive_periods, assumptions: metaData.assumptions } }
export function getDemoScenarios(): readonly MockDemoScenario[] { return demoScenarios }
export function getMockSessions() { return sessionsData }
export function getMockReportCategories() { return reportCategoriesData }
export function getMockDashboardData(): MockDashboardData { return sessionsData }
export function getMockOverview(): ApiOverview {
  const dashboard = getMockDashboardData()
  return {
    data_source: "placeholder",
    energy_delivered_kwh: dashboard.summary.energy_delivered_kwh,
    energy_delivered_week_kwh: dashboard.summary.weekly_energy_kwh,
    live_sessions: dashboard.summary.live_sessions,
    network_uptime_pct: dashboard.summary.network_uptime_pct,
    energy_trend: dashboard.energy_trend.map(({ day, energy }) => ({ date: day, kwh: energy })),
  }
}
export function getStations(region?: RegionId, timeMinutes = 480) { return getMockStations(timeMinutes).filter((station) => !region || station.region === region) }
export function getStationById(id: string, timeMinutes = 480) { return getMockStations(timeMinutes).find((station) => station.id === id) ?? null }
export function getRegions() { return regions }

function getBaseRevenue(station: ChargingStation) { return station.n_working === null ? 0 : Math.max(120, station.n_working * 42 - (station.predicted_wait_min ?? 0) * 3) }

export function runMockWhatIf(input: MockSimulationInput, timeMinutes: number): WhatIfResult {
  const station = getMockStations(timeMinutes).find(({ id }) => id === input.station_id)
  const beforeWait = station?.predicted_wait_min ?? 0
  const beforeRevenue = station ? getBaseRevenue(station) : 0
  let afterWait = beforeWait
  let afterRevenue = beforeRevenue
  if (input.scenario === "fix_now") {
    const rule = input.repair_timing === "after_peak" ? whatIfRules.after_peak : whatIfRules.fix_now
    afterWait = Math.max(0, beforeWait - rule.wait_improvement_min)
    afterRevenue = beforeRevenue + rule.wait_improvement_min * rule.revenue_per_min_rm
  }
  if (input.scenario === "add_chargers") {
    const added = input.n_chargers ?? 0
    afterWait = Math.max(0, beforeWait - added * whatIfRules.add_chargers.wait_reduction_per_charger_min)
    afterRevenue = beforeRevenue + added * whatIfRules.add_chargers.revenue_per_charger_rm
  }
  if (input.scenario === "discount") {
    const discount = input.discount_pct ?? 0
    afterWait = Math.max(0, beforeWait - Math.round(discount * whatIfRules.discount.wait_reduction_per_discount_point_min))
    afterRevenue = Math.max(0, Math.round(beforeRevenue * (1 - discount / 100 * whatIfRules.discount.revenue_retention_factor)))
  }
  const stationName = station?.name ?? input.station_id
  const summary = input.scenario === "fix_now"
    ? `${input.repair_timing === "after_peak" ? "Repairing after the next peak" : "Repairing now"} could reduce predicted waiting time at ${stationName} and protect estimated charging revenue.`
    : input.scenario === "add_chargers"
      ? `Adding ${input.n_chargers ?? 0} charger${input.n_chargers === 1 ? "" : "s"} could create more capacity at ${stationName} during high-demand periods.`
      : `A ${input.discount_pct ?? 0}% off-peak discount could shift demand toward quieter periods; revenue impact remains an estimate.`
  return { before_wait_min: beforeWait, after_wait_min: afterWait, before_revenue_rm: beforeRevenue, after_revenue_rm: afterRevenue, summary }
}

export function validateMockData() {
  const stations = readSeeds()
  const stationIds = new Set(stations.map(({ id }) => id))
  if (stationIds.size !== stations.length) throw new Error("Mock data error: station IDs must be unique.")
  stations.forEach((station) => { if (station.n_working !== null && station.n_chargers !== null && (station.n_working < 0 || station.n_working > station.n_chargers)) throw new Error(`Mock data error: invalid charger count for ${station.id}.`) })
  const chargerIds = new Set(stations.flatMap((station) => getMockChargers({ ...station, predicted_wait_min: null, level: "unavailable", forecast: [] }).map(({ id }) => id)))
  ;(actionsData as ActionSeed[]).forEach((action) => { if (!stationIds.has(action.station_id)) throw new Error(`Mock data error: unknown action station ${action.station_id}.`); if (action.charger_id && !chargerIds.has(action.charger_id)) throw new Error(`Mock data error: unknown action charger ${action.charger_id}.`) })
  ;(forecastProfiles as ForecastProfile[]).forEach((profile) => { if (!stationIds.has(profile.station_id)) throw new Error(`Mock data error: unknown forecast station ${profile.station_id}.`) })
  ;(chargerOverrides as ChargerOverride[]).forEach((charger) => { if (!stationIds.has(charger.station_id)) throw new Error(`Mock data error: unknown charger station ${charger.station_id}.`) })
  return true
}

validateMockData()
