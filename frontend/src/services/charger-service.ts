import type { ChargingStation } from "@/features/map/types"
import type { ChargerHealthPoint } from "@/features/chargers/types"
import { getMockChargerHealth } from "@/services/mockService"
import { fetchJson, isApiMode } from "@/services/api-client"

export async function fetchChargerHealth(chargerId: string, days = 7, station: ChargingStation | null = null): Promise<ChargerHealthPoint[]> {
  if (!isApiMode) return getMockChargerHealth(chargerId, station, days)
  return fetchJson<ChargerHealthPoint[]>(`/api/chargers/${encodeURIComponent(chargerId)}/health?days=${encodeURIComponent(String(days))}`)
}
