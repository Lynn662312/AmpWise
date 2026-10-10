import { Activity, AlertTriangle, CircleAlert, MessageCircleWarning, PlugZap, ShieldAlert } from "lucide-react"
import { AnimatedNumber } from "@/components/common/AnimatedNumber"
import { Card } from "@/components/ui/card"
import { IssueBadge } from "@/features/actions/components/IssueBadge"
import { UrgencyBadge } from "@/features/actions/components/UrgencyBadge"
import type { Action } from "@/features/actions/types"
import { cn } from "@/lib/utils"

type NetworkStatusCardProps = {
  onlineStations: number
  totalStations: number
  uptime: number | null
  alerts: readonly Action[]
  alertsLoading?: boolean
  alertsError?: boolean
  onAlertSelect: (action: Action) => void
  className?: string
}

const alertIcons = { safety_fault: ShieldAlert, degraded: Activity, connector_fault: PlugZap, user_reported: MessageCircleWarning, congestion: AlertTriangle } as const

export function NetworkStatusCard({ onlineStations, totalStations, uptime, alerts, alertsLoading = false, alertsError = false, onAlertSelect, className }: NetworkStatusCardProps) {
  const critical = alerts.some(({ issue_type, urgency }) => issue_type === "safety_fault" && urgency === "critical")
  const attention = alerts.length > 0
  const heading = critical ? "Critical issues detected" : attention ? "Attention required" : alertsError ? "Network status unavailable" : "All systems operational"
  const supportingText = alertsError ? "Charger alert data could not be loaded." : attention ? `${alerts.length} unresolved charger issue${alerts.length === 1 ? "" : "s"} need attention.` : "No urgent charger issues require attention."

  return <Card className={cn("overflow-hidden bg-primary p-0 text-primary-foreground", className)}><div className="flex h-full flex-col">
    <div className="flex items-start justify-between gap-4 p-5 sm:p-7"><div className="min-w-0"><p className="text-sm text-primary-foreground/60">Network status</p><h2 className="mt-2 font-display text-4xl font-semibold leading-none">{heading}</h2><p className="mt-3 text-xs text-primary-foreground/65">{supportingText}</p></div><span className={cn("grid size-11 shrink-0 place-items-center rounded-full", critical ? "bg-destructive text-primary-foreground" : attention ? "bg-warning text-primary" : "bg-accent text-primary")}><Activity size={21} /></span></div>
    <div className="mx-5 min-h-32 flex-1 rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-3 sm:mx-7 sm:p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/55">Latest charger alerts</p>{!alertsLoading && <span className="text-[11px] text-primary-foreground/45">Priority order</span>}</div>{alertsLoading ? <div className="space-y-2" aria-busy="true"><div className="h-12 animate-pulse rounded-xl bg-primary-foreground/10" /><div className="h-12 animate-pulse rounded-xl bg-primary-foreground/10" /></div> : alertsError ? <div className="flex items-center gap-2 rounded-xl bg-primary-foreground/10 px-3 py-4 text-xs text-primary-foreground/70"><CircleAlert size={15} /> Alert feed unavailable.</div> : alerts.length === 0 ? <div className="flex items-center gap-2 rounded-xl bg-primary-foreground/10 px-3 py-4 text-xs text-primary-foreground/70"><Activity size={15} className="text-accent" /> No urgent charger issues require attention.</div> : <div className="space-y-2">{alerts.slice(0, 2).map((action) => <AlertRow key={action.id} action={action} onSelect={() => onAlertSelect(action)} />)}</div>}</div>
    <div className="flex items-center justify-between gap-4 p-5 text-sm sm:p-7"><span className="text-primary-foreground/60">{onlineStations >= 0 ? <><AnimatedNumber value={onlineStations} /> of <AnimatedNumber value={totalStations} /> stations online</> : "Station totals unavailable"}</span><span className="font-semibold text-accent">{uptime === null ? "Uptime unavailable" : <AnimatedNumber value={uptime} decimals={1} suffix="% uptime" />}</span></div>
  </div></Card>
}

function AlertRow({ action, onSelect }: { action: Action; onSelect: () => void }) {
  const Icon = alertIcons[action.issue_type as keyof typeof alertIcons] ?? CircleAlert
  return <button type="button" onClick={onSelect} className="group flex w-full min-w-0 items-center gap-3 rounded-xl bg-primary-foreground/10 p-3 text-left transition hover:bg-primary-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-foreground/10 text-accent"><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{action.station_name}</span><span className="mt-0.5 block truncate text-[11px] text-primary-foreground/60">{action.charger_id ?? "Station-wide"} · {action.recommended_action}</span></span><span className="hidden shrink-0 items-center gap-1.5 sm:flex"><IssueBadge issue={action.issue_type} /><UrgencyBadge urgency={action.urgency} /></span></button>
}
