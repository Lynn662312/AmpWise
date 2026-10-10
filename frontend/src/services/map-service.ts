import { getMapSeedData, getMockStations, saveMapSeed } from "@/data/mockStations"
import type { ChargingStation } from "@/features/map/types"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000"

export type MapStationInput = {
  id: string
  name: string
  location: string
  lat: number
  lon: number
  n_chargers: number
  n_working: number
  power_kw: number
  baseWait: number
}

export async function getMapData(timeMinutes: number): Promise<{ stations: ChargingStation[]; source: "api" | "mock"; corridor: string }> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/stations?time=${encodeURIComponent(String(timeMinutes))}`, { signal: AbortSignal.timeout(3500) })
    if (!response.ok) throw new Error(`Request failed: ${response.status}`)
    return { stations: await response.json() as ChargingStation[], source: "api", corridor: getMapSeedData().corridor }
  } catch {
    const { corridor } = getMapSeedData()
    return { stations: getMockStations(timeMinutes), source: "mock", corridor }
  }
}

export async function postMapData(station: MapStationInput): Promise<{ station: MapStationInput; source: "api" | "local" }> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/stations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(station), signal: AbortSignal.timeout(3500) })
    if (!response.ok) throw new Error(`Request failed: ${response.status}`)
    return { station: await response.json() as MapStationInput, source: "api" }
  } catch {
    return { station: saveMapSeed(station), source: "local" }
  }
}
