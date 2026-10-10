import type { Action, ActionStatus, IssueType, Urgency } from "@/features/actions/types"
import type { ChargingStation } from "@/features/map/types"
import { getTimeZone } from "@/lib/simulationConfig"
export { formatCurrency } from "@/lib/simulationConfig"

export const urgencyOrder: Record<Urgency, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export function toUiStatus(state: Action["state"]): ActionStatus {
  return state === "assigned" ? "assigned" : state === "done" ? "completed" : "pending"
}

export function formatDeadline(deadline: string | null) {
  if (!deadline) return "No fixed deadline"
  return new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: getTimeZone() }).format(new Date(deadline))
}

export function formatReportedAt(value: string | null) {
  if (!value) return null
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return null
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: getTimeZone() }).format(timestamp)
}

export function isWithinNext24Hours(deadline: string | null, selectedIsoTime: string) {
  if (!deadline) return false
  const base = Date.parse(selectedIsoTime)
  const target = new Date(deadline).getTime()
  return target >= base && target <= base + 24 * 60 * 60 * 1000
}

export function resolveStationName(stationId: string, stations: readonly ChargingStation[]) {
  return stations.find(({ id }) => id === stationId)?.name ?? stationId
}

export function resolveStationLocation(stationId: string, stations: readonly ChargingStation[]) {
  return stations.find(({ id }) => id === stationId)?.location ?? stationId
}

export function matchesAction(action: Action, search: string, issues: IssueType[], urgency: Urgency | "all", stations: readonly ChargingStation[]) {
  const stationName = resolveStationName(action.station_id, stations)
  const searchable = `${stationName} ${action.station_id} ${action.charger_id ?? ""} ${action.recommended_action} ${action.reason}`.toLowerCase()
  return (!search || searchable.includes(search.trim().toLowerCase())) && (!issues.length || issues.includes(action.issue_type)) && (urgency === "all" || action.urgency === urgency)
}
