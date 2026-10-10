import type { BacktestResult } from "@/features/results/types"

export function formatRm(value: number) {
  return `RM ${new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 }).format(value)}`
}

export function formatNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("en-MY", { maximumFractionDigits }).format(value)
}

export function formatPercent(value: number) {
  const percent = value <= 1 ? value * 100 : value
  return `${new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 }).format(percent)}%`
}

export function getImpactMessage(result: BacktestResult) {
  if (result.queue_minutes_saved > 0 || result.rm_protected > 0) return "AmpWise reduced estimated waiting time in this evaluation."
  if (result.queue_minutes_saved < 0 || result.rm_protected < 0) return "The evaluated strategy did not improve outcomes in this period."
  return "The evaluated strategy showed no measurable improvement in this period."
}

export function getMaeReduction(ours: number, baseline: number) {
  if (baseline <= 0) return null
  return ((baseline - ours) / baseline) * 100
}
