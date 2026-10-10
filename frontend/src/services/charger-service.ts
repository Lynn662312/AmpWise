import type { ChargingStation } from "@/features/map/types"
import type { ChargerHealth } from "@/features/chargers/types"
import { getMockChargerHealth } from "@/services/mockService"
import { fetchJson, isApiMode } from "@/services/api-client"
import type { ApiChargerHealth } from "@/types/api"

export async function fetchChargerHealth(chargerId: string, days = 7, station: ChargingStation | null = null, time: string, signal?: AbortSignal): Promise<ChargerHealth> {
  if (!isApiMode) return getMockChargerHealth(chargerId, station, days)
  const health = await fetchJson<ApiChargerHealth>(`/api/chargers/${encodeURIComponent(chargerId)}/health?time=${encodeURIComponent(time)}&days=${encodeURIComponent(String(days))}`, { signal })
  return { charger_id: health.charger_id, station_id: health.station_id, status: health.status, p_fault: health.p_fault, evidence: health.evidence, degraded_since: health.degraded_since, series: health.series.map((point) => ({ time: point.date, actual_power_ratio: point.ratio, baseline_power_ratio: point.baseline, fault_probability: health.p_fault })) }
}
