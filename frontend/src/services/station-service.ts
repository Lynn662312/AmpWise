import { getMapData } from "@/services/map-service"
import type { ChargingStation, StationForecast } from "@/features/map/types"
import { fetchJson, isApiMode } from "@/services/api-client"
import { getMockChargers, getMockStations } from "@/services/mockService"
import type { ApiForecastSlot, ApiStationCharger } from "@/types/api"

export type StationCharger = { id: string; station_id: string; power_kw: number; status: string }

export async function fetchStations(timeMinutes: number, timeIso?: string, signal?: AbortSignal): Promise<{ stations: ChargingStation[]; source: "api" | "mock" }> {
  const { stations, source } = await getMapData(timeMinutes, timeIso, signal)
  return { stations, source }
}

export async function fetchStationForecast(stationId: string, start: string, hours = 2, timeMinutes = 480, signal?: AbortSignal): Promise<StationForecast[]> {
  if (!isApiMode) return getMockStations(timeMinutes).find(({ id }) => id === stationId)?.forecast ?? []
  const slots = await fetchJson<ApiForecastSlot[]>(`/api/stations/${encodeURIComponent(stationId)}/forecast?start=${encodeURIComponent(start)}&hours=${encodeURIComponent(String(hours))}`, { signal })
  return slots.map((slot) => ({ time: slot.slot_start, arrivals: slot.arrivals, predicted_wait_min: slot.wait_min, arrivals_baseline: slot.arrivals_baseline, level: slot.wait_min == null ? "unavailable" : slot.wait_min > 40 ? "high" : slot.wait_min >= 15 ? "moderate" : "low", is_festive: slot.is_festive }))
}

// The station's chargers come from the backend registry; charger ids are never built from n_chargers.
export async function fetchStationChargers(station: ChargingStation | null, time: string, signal?: AbortSignal): Promise<StationCharger[]> {
  if (!station) return []
  if (!isApiMode) return getMockChargers(station)
  const chargers = await fetchJson<ApiStationCharger[]>(`/api/stations/${encodeURIComponent(station.id)}/chargers?time=${encodeURIComponent(time)}`, { signal })
  return chargers.map((charger) => ({ id: charger.charger_id, station_id: charger.station_id, power_kw: charger.power_kw, status: charger.status }))
}
