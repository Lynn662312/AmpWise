import { getMapSeedData, getMockStations, saveMapSeed } from "@/services/mockService"
import type { ChargingStation } from "@/features/map/types"
import { fetchJson, isApiMode } from "@/services/api-client"

export type MapStationInput = {
  id: string
  name: string
  region: string
  location: string | null
  lat: number
  lon: number
  n_chargers: number | null
  n_working: number | null
  power_kw: number | null
  baseWait: number | null
}

export async function getMapData(timeMinutes: number): Promise<{ stations: ChargingStation[]; source: "api" | "mock"; corridor: string }> {
  if (!isApiMode) return { stations: getMockStations(timeMinutes), source: "mock", corridor: getMapSeedData().corridor }
  return { stations: await fetchJson<ChargingStation[]>(`/api/stations?time=${encodeURIComponent(String(timeMinutes))}`), source: "api", corridor: getMapSeedData().corridor }
}

export async function postMapData(station: MapStationInput): Promise<{ station: MapStationInput; source: "api" | "local" }> {
  if (!isApiMode) return { station: saveMapSeed(station), source: "local" }
  return { station: await fetchJson<MapStationInput>("/api/stations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(station) }), source: "api" }
}
