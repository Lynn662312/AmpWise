import { CarFront, Sparkles, Wrench } from "lucide-react"
import { Card } from "@/components/ui/card"

const strategies = [
  { title: "Traditional operations", icon: Wrench, points: ["Repair chargers in reported order", "Drivers use the nearest station"] },
  { title: "AmpWise approach", icon: Sparkles, points: ["Prioritize maintenance using predicted impact", "Safety faults first; forecasts guide station choices"] },
] as const

export function StrategyComparison() {
  return <section><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">The benchmark</p><h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Traditional Operations vs AmpWise</h2></div><CarFront className="hidden text-primary sm:block" size={24} /></div><div className="mt-4 grid gap-3 md:grid-cols-2">{strategies.map(({ title, icon: Icon, points }) => <Card key={title} className="p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-brand-soft text-primary"><Icon size={18} /></span><h3 className="text-base font-semibold">{title}</h3></div><ul className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">{points.map((point) => <li key={point} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{point}</li>)}</ul></Card>)}</div><p className="mt-3 text-xs leading-5 text-muted-foreground">The API supplies aggregate impact figures rather than complete before/after distributions, so this comparison explains the operating strategies without inventing scenario-level waits.</p></section>
}
