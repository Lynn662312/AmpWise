import { getMapSeedData, getMockStations, saveMapSeed } from "@/data/mockStations"
import type { ChargingStation } from "@/features/map/types"
import { fetchJson, isApiMode } from "@/services/api-client"

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
  if (!isApiMode) return { stations: getMockStations(timeMinutes), source: "mock", corridor: getMapSeedData().corridor }
  return { stations: await fetchJson<ChargingStation[]>(`/api/stations?time=${encodeURIComponent(String(timeMinutes))}`), source: "api", corridor: getMapSeedData().corridor }
}

export async function postMapData(station: MapStationInput): Promise<{ station: MapStationInput; source: "api" | "local" }> {
  if (!isApiMode) return { station: saveMapSeed(station), source: "local" }
  return { station: await fetchJson<MapStationInput>("/api/stations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(station) }), source: "api" }
}
