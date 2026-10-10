import { getMapSeedData, getMockStations, saveMapSeed } from "@/services/mockService"
import type { ChargingStation } from "@/features/map/types"
import { fetchJson, isApiMode } from "@/services/api-client"
import type { ApiStation } from "@/types/api"

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

export async function getMapData(timeMinutes: number, timeIso?: string, signal?: AbortSignal): Promise<{ stations: ChargingStation[]; source: "api" | "mock"; corridor: string }> {
  if (!isApiMode) return { stations: getMockStations(timeMinutes), source: "mock", corridor: getMapSeedData().corridor }
  const stations = await fetchJson<ApiStation[]>(`/api/stations?time=${encodeURIComponent(timeIso ?? String(timeMinutes))}`, { signal })
  return { stations: stations.map((station) => ({ ...station, region: "california", location: null, level: station.level === "green" ? "low" : station.level === "amber" ? "moderate" : "high", forecast: [] })), source: "api", corridor: "California charging network" }
}

export async function postMapData(station: MapStationInput): Promise<{ station: MapStationInput; source: "api" | "local" }> {
  if (!isApiMode) return { station: saveMapSeed(station), source: "local" }
  return { station: await fetchJson<MapStationInput>("/api/stations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(station) }), source: "api" }
}
