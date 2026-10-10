import type { BacktestResult } from "@/features/results/types"
export { formatNumber, formatPercent } from "@/lib/formatters"
export { formatCurrency, getCurrencyCode } from "@/lib/simulationConfig"

export function getImpactMessage(result: BacktestResult) {
  if (result.queue_minutes_saved > 0 || result.rm_protected > 0) return "AmpWise reduced estimated waiting time in this evaluation."
  if (result.queue_minutes_saved < 0 || result.rm_protected < 0) return "The evaluated strategy did not improve outcomes in this period."
  return "The evaluated strategy showed no measurable improvement in this period."
}

export function getMaeReduction(ours: number, baseline: number) {
  if (baseline <= 0) return null
  return ((baseline - ours) / baseline) * 100
}
