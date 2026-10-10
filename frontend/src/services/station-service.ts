import { getMockStations } from "@/data/mockStations"
import { getMapData, postMapData, type MapStationInput } from "@/services/map-service"
import type { ChargingStation, StationForecast } from "@/features/map/types"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000"

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { signal: AbortSignal.timeout(3500) })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.json() as Promise<T>
}

export async function fetchStations(timeMinutes: number): Promise<{ stations: ChargingStation[]; source: "api" | "mock" }> {
  const { stations, source } = await getMapData(timeMinutes)
  return { stations, source }
}

export { postMapData }
export type { MapStationInput }

export async function fetchStationForecast(stationId: string, timeMinutes: number): Promise<StationForecast[]> {
  try {
    return await getJson<StationForecast[]>(`/api/stations/${encodeURIComponent(stationId)}/forecast?time=${encodeURIComponent(String(timeMinutes))}`)
  } catch {
    return getMockStations(timeMinutes).find(({ id }) => id === stationId)?.forecast ?? []
  }
}
