import type { ChargingStation } from "@/features/map/types"
import type { ChargerHealthPoint } from "@/features/chargers/types"
import { getMockChargers } from "@/mocks/chargers"
import { fetchJson, isApiMode } from "@/services/api-client"

function mockHealth(chargerId: string, station: ChargingStation | null, days: number): ChargerHealthPoint[] {
  const charger = getMockChargers(station).find(({ id }) => id === chargerId)
  const degraded = charger?.status === "degraded" || charger?.status === "offline"
  return Array.from({ length: Math.max(1, Math.min(days, 14)) }, (_, index) => {
    const actual = degraded ? Math.max(0, 0.72 - index * 0.025) : 0.96 - (index % 3) * 0.02
    return { time: `Day ${index + 1}`, actual_power_ratio: Number(actual.toFixed(2)), baseline_power_ratio: 1, fault_probability: Number((degraded ? 0.72 - index * 0.03 : 0.08 + (index % 2) * 0.02).toFixed(2)) }
  })
}

export async function fetchChargerHealth(chargerId: string, days = 7, station: ChargingStation | null = null): Promise<ChargerHealthPoint[]> {
  if (!isApiMode) return mockHealth(chargerId, station, days)
  return fetchJson<ChargerHealthPoint[]>(`/api/chargers/${encodeURIComponent(chargerId)}/health?days=${encodeURIComponent(String(days))}`)
}
