import type { RepairTiming, SimulationResponse, WhatIfRequest, WhatIfResult } from "@/features/what-if/types"
import { fetchJson, isApiMode } from "@/services/api-client"
import { runMockWhatIf } from "@/services/mockService"

export const isWhatIfMockMode = !isApiMode

export type SimulationInput = WhatIfRequest & { repair_timing?: RepairTiming }

export async function postWhatIf(input: SimulationInput, timeMinutes: number): Promise<SimulationResponse> {
  if (isWhatIfMockMode) return { ...runMockWhatIf(input, timeMinutes), source: "mock" }
  const { repair_timing: _repairTiming, ...request } = input
  return { ...await fetchJson<WhatIfResult>("/api/whatif", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) }), source: "api" }
}
