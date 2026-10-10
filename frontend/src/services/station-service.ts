import { getMockStations } from "@/data/mockStations"
import { getMapData, postMapData, type MapStationInput } from "@/services/map-service"
import type { ChargingStation, StationForecast } from "@/features/map/types"
import { fetchJson, isApiMode } from "@/services/api-client"

export async function fetchStations(timeMinutes: number): Promise<{ stations: ChargingStation[]; source: "api" | "mock" }> {
  const { stations, source } = await getMapData(timeMinutes)
  return { stations, source }
}

export { postMapData }
export type { MapStationInput }

export async function fetchStationForecast(stationId: string, start: string, hours = 2, timeMinutes = 480): Promise<StationForecast[]> {
  if (!isApiMode) return getMockStations(timeMinutes).find(({ id }) => id === stationId)?.forecast ?? []
  return fetchJson<StationForecast[]>(`/api/stations/${encodeURIComponent(stationId)}/forecast?start=${encodeURIComponent(start)}&hours=${encodeURIComponent(String(hours))}`)
}
