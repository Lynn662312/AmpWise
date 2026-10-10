import { ArrowDown, ArrowUp, Clock3, CircleDollarSign, Gauge, TrendingDown } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { SimulationResponse } from "@/features/what-if/types"
import { formatRm, getImpact } from "@/features/what-if/utils/simulationHelpers"

const definitions = [
  { key: "wait", label: "Predicted waiting time", icon: Clock3 },
  { key: "revenue", label: "Estimated charging revenue", icon: CircleDollarSign },
  { key: "waitDelta", label: "Waiting time difference", icon: TrendingDown },
  { key: "revenueDelta", label: "Revenue difference", icon: Gauge },
] as const

export function ImpactKpiCards({ result }: { result: SimulationResponse }) {
  const { waitDifference, revenueDifference } = getImpact(result)
  const values = { wait: `${result.after_wait_min} min`, revenue: formatRm(result.after_revenue_rm), waitDelta: `${waitDifference >= 0 ? "−" : "+"}${Math.abs(waitDifference)} min`, revenueDelta: `${revenueDifference >= 0 ? "+" : "−"}${formatRm(Math.abs(revenueDifference))}` }
  return <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{definitions.map(({ key, label, icon: Icon }) => { const positive = key === "waitDelta" ? waitDifference >= 0 : key === "revenueDelta" ? revenueDifference >= 0 : true; return <Card key={key} className="p-4 sm:p-5"><div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-primary"><Icon size={17} /></span><span className={positive ? "text-success" : "text-destructive"}>{key.includes("Delta") ? positive ? <ArrowDown size={15} /> : <ArrowUp size={15} /> : null}</span></div><p className="mt-4 text-xs font-medium text-muted-foreground sm:text-sm">{label}</p><p className="mt-1 font-display text-3xl font-semibold sm:text-4xl">{values[key]}</p>{key === "revenue" && <p className="mt-1 text-[10px] text-muted-foreground">Estimate only</p>}</Card> })}</section>
}
