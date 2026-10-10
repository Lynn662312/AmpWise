import type { SimulationResponse, WhatIfRequest } from "@/features/what-if/types"
export { formatCurrency } from "@/lib/simulationConfig"

export function getImpact(result: SimulationResponse) {
  return { waitDifference: result.before_wait_min - result.after_wait_min, revenueDifference: result.after_revenue_rm - result.before_revenue_rm }
}

export function isValidRequest(request: WhatIfRequest) {
  if (!request.station_id) return false
  if (request.scenario === "fix_now" && !request.charger_id) return false
  if (request.scenario === "add_chargers" && (!request.n_chargers || request.n_chargers < 1)) return false
  if (request.scenario === "discount" && (request.discount_pct === undefined || request.discount_pct < 1)) return false
  return true
}
