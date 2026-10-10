import type { LatLngBoundsExpression } from "leaflet"
import type { ChargingStation, StationFilter, StationLevel } from "@/features/map/types"

export const corridorCenter: [number, number] = [2.55, 102.45]
export const corridorZoom = 8

export function filterStations(stations: readonly ChargingStation[], query: string, filter: StationFilter) {
  const normalizedQuery = query.trim().toLowerCase()
  return stations.filter((station) => {
    const matchesQuery = !normalizedQuery || `${station.name} ${station.location}`.toLowerCase().includes(normalizedQuery)
    return matchesQuery && (filter === "all" || station.level === filter)
  })
}

export function getStationBounds(stations: readonly ChargingStation[]): LatLngBoundsExpression | null {
  if (!stations.length) return null
  return stations.map(({ lat, lon }) => [lat, lon] as [number, number])
}

export function getLevelLabel(level: StationLevel) {
  return { low: "Low wait", moderate: "Moderate", high: "High congestion", unavailable: "Unavailable" }[level]
}

export function getLevelClass(level: StationLevel) {
  return { low: "station-marker--low", moderate: "station-marker--moderate", high: "station-marker--high", unavailable: "station-marker--unavailable" }[level]
}

export function isValidWait(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function formatWaitMinutes(value: number | null | undefined) {
  if (!isValidWait(value)) return "Prediction unavailable"
  return `${formatWaitValue(value)} min predicted wait`
}

export function formatWaitValue(value: number | null | undefined) {
  return isValidWait(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value) : "—"
}
