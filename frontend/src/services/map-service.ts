import { getMapSeedData, getMockStations } from "@/services/mockService"
import type { ChargingStation } from "@/features/map/types"
import { fetchJson, isApiMode } from "@/services/api-client"
import type { ApiStation } from "@/types/api"

export async function getMapData(timeMinutes: number, timeIso?: string, signal?: AbortSignal): Promise<{ stations: ChargingStation[]; source: "api" | "mock"; corridor: string }> {
  if (!isApiMode) return { stations: getMockStations(timeMinutes), source: "mock", corridor: getMapSeedData().corridor }
  const stations = await fetchJson<ApiStation[]>(`/api/stations?time=${encodeURIComponent(timeIso ?? String(timeMinutes))}`, { signal })
  return { stations: stations.map((station) => ({ ...station, region: "california", location: null, level: station.level === "green" ? "low" : station.level === "amber" ? "moderate" : "high", forecast: [] })), source: "api", corridor: "California charging network" }
}
