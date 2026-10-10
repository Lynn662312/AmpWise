import type { Action, IssueType, Urgency } from "@/features/actions/types"
import type { ChargingStation } from "@/features/map/types"

export const urgencyOrder: Record<Urgency, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export function formatRm(value: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(value)
}

export function formatDeadline(deadline: string | null) {
  if (!deadline) return "No fixed deadline"
  return new Intl.DateTimeFormat("en-MY", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kuala_Lumpur" }).format(new Date(deadline))
}

export function isWithinNext24Hours(deadline: string | null, selectedTime: number) {
  if (!deadline) return false
  const base = new Date("2026-10-10T00:00:00+08:00").getTime() + selectedTime * 60_000
  const target = new Date(deadline).getTime()
  return target >= base && target <= base + 24 * 60 * 60 * 1000
}

export function getRecommendedActionSort(a: Action, b: Action) {
  const safetyDifference = Number(a.issue_type !== "safety_fault") - Number(b.issue_type !== "safety_fault")
  return safetyDifference || a.rank - b.rank
}

export function resolveStationName(stationId: string, stations: readonly ChargingStation[]) {
  return stations.find(({ id }) => id === stationId)?.name ?? stationId
}

export function resolveStationLocation(stationId: string, stations: readonly ChargingStation[]) {
  return stations.find(({ id }) => id === stationId)?.location ?? "Station location unavailable"
}

export function matchesAction(action: Action, search: string, issues: IssueType[], urgency: Urgency | "all", stations: readonly ChargingStation[]) {
  const stationName = resolveStationName(action.station_id, stations)
  const searchable = `${stationName} ${action.station_id} ${action.charger_id ?? ""} ${action.recommended_action} ${action.reason}`.toLowerCase()
  return (!search || searchable.includes(search.trim().toLowerCase())) && (!issues.length || issues.includes(action.issue_type)) && (urgency === "all" || action.urgency === urgency)
}
