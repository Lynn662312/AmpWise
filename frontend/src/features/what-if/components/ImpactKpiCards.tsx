import { ArrowDown, ArrowUp, Clock3, CircleDollarSign, Gauge, TrendingDown } from "lucide-react"
import { MetricCard } from "@/components/common/MetricCard"
import type { SimulationResponse } from "@/features/what-if/types"
import { getImpact } from "@/features/what-if/utils/simulationHelpers"
import { getCurrencyCode } from "@/lib/simulationConfig"

const definitions = [
  { key: "wait", label: "Predicted waiting time", icon: Clock3 },
  { key: "revenue", label: "Estimated charging revenue", icon: CircleDollarSign },
  { key: "waitDelta", label: "Waiting time difference", icon: TrendingDown },
  { key: "revenueDelta", label: "Revenue difference", icon: Gauge },
] as const

export function ImpactKpiCards({ result }: { result: SimulationResponse }) {
  const { waitDifference, revenueDifference } = getImpact(result)
  return <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{definitions.map(({ key, label, icon: Icon }) => { const positive = key === "waitDelta" ? waitDifference >= 0 : key === "revenueDelta" ? revenueDifference >= 0 : true; const isWait = key === "wait" || key === "waitDelta"; const numericValue = key === "wait" ? result.after_wait_min : key === "revenue" ? result.after_revenue_rm : key === "waitDelta" ? Math.abs(waitDifference) : Math.abs(revenueDifference); return <MetricCard key={key} label={label} value={numericValue} icon={<Icon size={17} />} suffix={isWait ? " min" : undefined} decimals={isWait ? 1 : undefined} prefix={key === "revenue" ? `${getCurrencyCode()} ` : key === "revenueDelta" ? `${revenueDifference === 0 ? "" : revenueDifference > 0 ? "+" : "−"}${getCurrencyCode()} ` : key === "waitDelta" ? (waitDifference === 0 ? "" : waitDifference > 0 ? "−" : "+") : undefined} description={key === "revenue" ? "Estimate only" : key === "wait" ? `Before: ${result.before_wait_min} min` : (key === "waitDelta" && waitDifference === 0) || (key === "revenueDelta" && revenueDifference === 0) ? "No change" : undefined} trailing={key.includes("Delta") ? <span className={positive ? "text-success" : "text-destructive"}>{positive ? <ArrowDown size={15} /> : <ArrowUp size={15} />}</span> : undefined} /> })}</section>
}
