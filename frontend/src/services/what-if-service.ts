import { getMockStations } from "@/data/mockStations"
import type { ChargingStation } from "@/features/map/types"
import type { RepairTiming, SimulationResponse, WhatIfRequest, WhatIfResult } from "@/features/what-if/types"
import { fetchJson, isApiMode } from "@/services/api-client"

export const isWhatIfMockMode = !isApiMode

export type SimulationInput = WhatIfRequest & { repair_timing?: RepairTiming }

function getBaseRevenue(station: ChargingStation) {
  return Math.max(120, station.n_working * 42 - (station.predicted_wait_min ?? 0) * 3)
}

function simulateLocally(input: SimulationInput, stations: ChargingStation[]): WhatIfResult {
  const station = stations.find(({ id }) => id === input.station_id)
  const beforeWait = station?.predicted_wait_min ?? 0
  const beforeRevenue = station ? getBaseRevenue(station) : 0
  let afterWait = beforeWait
  let afterRevenue = beforeRevenue
  if (input.scenario === "fix_now") {
    const improvement = input.repair_timing === "after_peak" ? 4 : 12
    afterWait = Math.max(0, beforeWait - improvement)
    afterRevenue = beforeRevenue + improvement * 7
  }
  if (input.scenario === "add_chargers") {
    const added = input.n_chargers ?? 0
    afterWait = Math.max(0, beforeWait - added * 4)
    afterRevenue = beforeRevenue + added * 45
  }
  if (input.scenario === "discount") {
    const discount = input.discount_pct ?? 0
    afterWait = Math.max(0, beforeWait - Math.round(discount / 2))
    afterRevenue = Math.max(0, Math.round(beforeRevenue * (1 - discount / 100 * 0.35)))
  }
  const summary = input.scenario === "fix_now"
    ? `${input.repair_timing === "after_peak" ? "Repairing after the next peak" : "Repairing now"} could reduce predicted waiting time at ${station?.name ?? input.station_id} and protect estimated charging revenue.`
    : input.scenario === "add_chargers"
      ? `Adding ${input.n_chargers ?? 0} charger${input.n_chargers === 1 ? "" : "s"} could create more capacity at ${station?.name ?? input.station_id} during high-demand periods.`
      : `A ${input.discount_pct ?? 0}% off-peak discount could shift demand toward quieter periods; revenue impact remains an estimate.`
  return { before_wait_min: beforeWait, after_wait_min: afterWait, before_revenue_rm: beforeRevenue, after_revenue_rm: afterRevenue, summary }
}

export async function postWhatIf(input: SimulationInput, timeMinutes: number): Promise<SimulationResponse> {
  if (isWhatIfMockMode) return { ...simulateLocally(input, getMockStations(timeMinutes)), source: "mock" }
  const { repair_timing: _repairTiming, ...request } = input
  return { ...await fetchJson<WhatIfResult>("/api/whatif", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) }), source: "api" }
}
