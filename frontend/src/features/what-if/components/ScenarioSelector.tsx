import { BadgePercent, BatteryCharging, Plus, Wrench } from "lucide-react"
import type { ScenarioType } from "@/features/what-if/types"
import { cn } from "@/lib/utils"

const scenarios: { value: ScenarioType; label: string; description: string; icon: typeof Wrench; live: boolean }[] = [
  { value: "fix_now", label: "Repair charger", description: "Compare fixing a failing charger before the next peak.", icon: Wrench, live: true },
  { value: "add_chargers", label: "Add chargers", description: "Estimate the impact of adding charging capacity.", icon: Plus, live: false },
  { value: "discount", label: "Off-peak discount", description: "Estimate demand shifting with a time-based discount.", icon: BadgePercent, live: false },
]

export function ScenarioSelector({ value, liveMode, onChange }: { value: ScenarioType; liveMode: boolean; onChange: (value: ScenarioType) => void }) {
  return <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">{scenarios.map(({ value: scenario, label, description, icon: Icon, live }) => <button key={scenario} type="button" disabled={liveMode && !live} onClick={() => onChange(scenario)} className={cn("flex items-start gap-3 rounded-2xl border border-border p-3 text-left transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-45", value === scenario && "border-primary bg-muted ring-2 ring-primary/10")}><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-primary", value === scenario && "bg-primary text-primary-foreground")}><Icon size={17} /></span><span className="min-w-0"><span className="flex items-center gap-2 text-sm font-semibold">{label}{!live && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Unavailable</span>}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span></button>)}</div>
}
