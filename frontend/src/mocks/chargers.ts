import type { ChargingStation } from "@/features/map/types"

export type MockCharger = { id: string; station_id: string; power_kw: number; status: "working" | "degraded" | "offline" }

export function getMockChargers(station: ChargingStation | null): MockCharger[] {
  if (!station) return []
  return Array.from({ length: station.n_chargers }, (_, index) => {
    const number = index + 1
    const status = number > station.n_working ? "offline" : number === 2 && station.id === "cyberjaya-techpark" ? "degraded" : "working"
    return { id: `${station.id}_c${number}`, station_id: station.id, power_kw: Math.round(station.power_kw / Math.max(1, station.n_chargers / 4)), status }
  })
}
