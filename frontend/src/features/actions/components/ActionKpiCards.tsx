import { AlertTriangle, CircleDollarSign, ClipboardList, Clock3 } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { Action } from "@/features/actions/types"
import { formatRm, isWithinNext24Hours } from "@/features/actions/utils/actionHelpers"

const definitions = [
  { key: "total", label: "Total actions", icon: ClipboardList, tone: "text-primary" },
  { key: "critical", label: "Critical actions", icon: AlertTriangle, tone: "text-destructive" },
  { key: "risk", label: "Estimated RM at risk", icon: CircleDollarSign, tone: "text-warning" },
  { key: "urgent", label: "Urgent deadlines", icon: Clock3, tone: "text-info" },
] as const

export function ActionKpiCards({ actions, selectedTime, loading }: { actions: readonly Action[]; selectedTime: number; loading: boolean }) {
  const values = { total: actions.length, critical: actions.filter(({ urgency }) => urgency === "critical").length, risk: actions.reduce((sum, action) => sum + action.rm_at_risk, 0), urgent: actions.filter(({ deadline }) => isWithinNext24Hours(deadline, selectedTime)).length }
  return <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{definitions.map(({ key, label, icon: Icon, tone }) => <Card key={key} className="p-4 sm:p-5"><div className="flex items-center justify-between"><span className={`grid h-9 w-9 place-items-center rounded-xl bg-muted ${tone}`}><Icon size={17} /></span>{loading && <span className="h-4 w-10 animate-pulse rounded bg-muted" />}</div><p className="mt-4 text-xs font-medium text-muted-foreground sm:text-sm">{label}</p><p className="mt-1 font-display text-3xl font-semibold sm:text-4xl">{loading ? "—" : key === "risk" ? formatRm(values[key]) : values[key]}</p>{key === "risk" && <p className="mt-1 text-[10px] text-muted-foreground">Estimate, not confirmed loss</p>}</Card>)}</section>
}
