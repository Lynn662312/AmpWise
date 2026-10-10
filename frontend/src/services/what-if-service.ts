import type { RepairTiming, SavedScenario, SimulationResponse, WhatIfRequest, WhatIfResult } from "@/features/what-if/types"
import { fetchJson, isApiMode } from "@/services/api-client"
import { runMockWhatIf } from "@/services/mockService"

export const isWhatIfMockMode = !isApiMode

export type SimulationInput = WhatIfRequest & { repair_timing?: RepairTiming }

export async function postWhatIf(input: SimulationInput, timeMinutes: number): Promise<SimulationResponse> {
  if (isWhatIfMockMode) return { ...runMockWhatIf(input, timeMinutes), source: "mock" }
  const { repair_timing: _repairTiming, ...request } = input
  return { ...await fetchJson<WhatIfResult>("/api/whatif", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) }), source: "api" }
}

// Saved runs live in the backend's database, so they need the same switch as assign / mark done.
export const savedRunsEnabled = isApiMode && import.meta.env.VITE_ACTION_STATUS_ENABLED === "true"

export function fetchScenarios(signal?: AbortSignal): Promise<SavedScenario[]> {
  return fetchJson<SavedScenario[]>("/api/scenarios", { signal })
}

export function saveScenario(name: string, input: SimulationInput, response: SimulationResponse): Promise<SavedScenario> {
  const { repair_timing: _repairTiming, ...request } = input
  const { source: _source, ...result } = response
  return fetchJson<SavedScenario>("/api/scenarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.slice(0, 80), request, result }) })
}
