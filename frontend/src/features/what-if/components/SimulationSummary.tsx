import { BadgeCheck, Info, TriangleAlert } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { SimulationResponse } from "@/features/what-if/types"
import { getImpact } from "@/features/what-if/utils/simulationHelpers"
import { cn } from "@/lib/utils"

export function SimulationSummary({ result, stationName }: { result: SimulationResponse; stationName: string }) {
  const { waitDifference, revenueDifference } = getImpact(result)
  const improved = waitDifference > 0 || revenueDifference > 0
  return <Card className={cn("overflow-hidden p-0", improved ? "border-success/30" : "border-warning/30")}><div className="flex items-start gap-3 bg-primary p-5 text-primary-foreground sm:p-6"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">{improved ? <BadgeCheck size={19} /> : <TriangleAlert size={19} />}</span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-3xl font-semibold">Simulation result</h2><span className="rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide">{result.source === "mock" ? "Simulated result" : "Model estimate"}</span></div><p className="mt-2 text-sm leading-6 text-primary-foreground/75">{result.summary}</p></div></div><div className="flex items-center gap-2 p-4 text-xs text-muted-foreground sm:p-5"><Info size={14} className="shrink-0 text-primary" />{stationName} · Results are projections, not achieved outcomes.</div></Card>
}
