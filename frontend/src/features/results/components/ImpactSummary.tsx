import { ArrowDownRight, ArrowUpRight, Clock3, ShieldCheck, WalletCards } from "lucide-react"
import { Card } from "@/components/ui/card"
import { AnimatedNumber } from "@/components/common/AnimatedNumber"
import { MetricInfoPopover } from "@/features/results/components/MetricInfoPopover"
import type { BacktestResult } from "@/features/results/types"
import { getImpactMessage } from "@/features/results/utils/resultsHelpers"
import { getCurrencyCode } from "@/lib/simulationConfig"
import { cn } from "@/lib/utils"

const metrics = [
  { key: "queue", label: "Queue time saved", icon: Clock3, info: "Estimated queue minutes avoided by the evaluated maintenance and congestion strategy." },
  { key: "revenue", label: "Revenue protected", icon: WalletCards, info: "Estimated charging revenue protected. This is an impact estimate, not confirmed earned revenue." },
] as const

export function ImpactSummary({ result, source }: { result: BacktestResult; source: "api" | "mock" }) {
  const improved = result.queue_minutes_saved > 0 || result.rm_protected > 0
  return <Card className="overflow-hidden p-0"><div className="flex flex-col justify-between gap-4 bg-primary p-5 text-primary-foreground sm:flex-row sm:items-start sm:p-7"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/60">Selected evaluation</p><h2 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">The impact, at a glance.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/70">{getImpactMessage(result)}</p></div></div><div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">{metrics.map(({ key, label, icon: Icon, info }) => <div key={key} className="p-5 sm:p-7"><div className="flex items-center gap-2 text-muted-foreground"><span className="grid size-9 place-items-center rounded-full bg-brand-soft text-primary"><Icon size={17} /></span><span className="text-sm font-semibold">{label}</span><MetricInfoPopover label={label}>{info}</MetricInfoPopover></div><p className="mt-5 font-display text-5xl font-semibold tracking-tight">{key === "queue" ? <AnimatedNumber value={result.queue_minutes_saved} decimals={0} suffix=" min" /> : <AnimatedNumber value={result.rm_protected} decimals={0} prefix={`${getCurrencyCode()} `} />}</p><p className="mt-1 text-xs text-muted-foreground">{key === "queue" ? "estimated queue minutes avoided" : "estimated potential impact"}</p></div>)}<div className="p-5 sm:col-span-2 sm:flex sm:items-center sm:justify-between sm:p-7"><div className="flex items-start gap-3"><span className={cn("mt-0.5 grid size-9 place-items-center rounded-full", improved ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{improved ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}</span><div><p className="text-sm font-semibold">Overall impact</p><p className="mt-1 text-sm text-muted-foreground">{improved ? "The measured direction is positive for this evaluation." : "No positive impact was measured for this evaluation."}</p></div></div><ShieldCheck className="mt-4 text-primary sm:mt-0" size={22} aria-hidden="true" /></div></div></Card>
}
