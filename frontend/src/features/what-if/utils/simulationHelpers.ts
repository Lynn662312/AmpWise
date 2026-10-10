import type { SimulationResponse, WhatIfRequest } from "@/features/what-if/types"

export function formatRm(value: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(value)
}

export function formatApiTime(minutes: number) {
  const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const date = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]))
  return `${date.year}-${date.month}-${date.day}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00+08:00`
}

export function getImpact(result: SimulationResponse) {
  return { waitDifference: result.before_wait_min - result.after_wait_min, revenueDifference: result.after_revenue_rm - result.before_revenue_rm }
}

export function isValidRequest(request: WhatIfRequest) {
  if (!request.station_id) return false
  if (request.scenario === "fix_now" && !request.charger_id) return false
  if (request.scenario === "add_chargers" && (!request.n_chargers || request.n_chargers < 1)) return false
  if (request.scenario === "discount" && (request.discount_pct === null || request.discount_pct < 1)) return false
  return true
}
