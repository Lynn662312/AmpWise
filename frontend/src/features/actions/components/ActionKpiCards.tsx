import { AlertTriangle, CircleDollarSign, ClipboardList, Clock3 } from "lucide-react"
import { MetricCard } from "@/components/common/MetricCard"
import type { Action } from "@/features/actions/types"
import { isWithinNext24Hours } from "@/features/actions/utils/actionHelpers"

const definitions = [
  { key: "total", label: "Total actions", icon: ClipboardList, tone: "text-primary" },
  { key: "critical", label: "Critical actions", icon: AlertTriangle, tone: "text-destructive" },
  { key: "risk", label: "Estimated RM at risk", icon: CircleDollarSign, tone: "text-warning" },
  { key: "urgent", label: "Urgent deadlines", icon: Clock3, tone: "text-info" },
] as const

export function ActionKpiCards({ actions, selectedTime, loading }: { actions: readonly Action[]; selectedTime: number; loading: boolean }) {
  const values = { total: actions.length, critical: actions.filter(({ urgency }) => urgency === "critical").length, risk: actions.reduce((sum, action) => sum + action.rm_at_risk, 0), urgent: actions.filter(({ deadline }) => isWithinNext24Hours(deadline, selectedTime)).length }
  return <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{definitions.map(({ key, label, icon: Icon, tone }) => <MetricCard key={key} label={label} value={values[key]} icon={<Icon size={17} />} tone={tone} prefix={key === "risk" ? "RM " : undefined} description={key === "risk" ? "Estimate, not confirmed loss" : undefined} loading={loading} />)}</section>
}
