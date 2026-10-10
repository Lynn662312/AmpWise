import * as Dialog from "@radix-ui/react-dialog"
import { ArrowUpRight, Check, ExternalLink, MapPin, UserRound, X } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import type { Action, ActionStatus } from "@/features/actions/types"
import type { ChargingStation } from "@/features/map/types"
import { issueConfig } from "@/features/actions/config/issueConfig"
import { formatDeadline, formatRm, resolveStationLocation, resolveStationName } from "@/features/actions/utils/actionHelpers"
import { ActionRecommendation } from "@/features/actions/components/ActionRecommendation"
import { IssueBadge } from "@/features/actions/components/IssueBadge"
import { UrgencyBadge } from "@/features/actions/components/UrgencyBadge"

export function ActionDetailDrawer({ action, stations, status, open, onOpenChange, onStatusChange }: { action: Action | null; stations: readonly ChargingStation[]; status: ActionStatus; open: boolean; onOpenChange: (open: boolean) => void; onStatusChange: (status: ActionStatus) => void }) {
  if (!action) return null
  const config = issueConfig[action.issue_type]
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-primary/25 backdrop-blur-[2px]" />
      <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-[1.75rem] border border-border bg-card p-5 shadow-2xl outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[min(470px,100vw)] sm:rounded-none sm:rounded-l-[1.75rem] sm:p-7">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-muted sm:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Action #{action.rank} · {config.category}</p><Dialog.Title className="mt-2 font-display text-4xl font-semibold leading-none">{config.label}</Dialog.Title><Dialog.Description className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 shrink-0" size={15} />{resolveStationName(action.station_id, stations)} · {resolveStationLocation(action.station_id, stations)}</Dialog.Description></div>
          <Dialog.Close className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close action details"><X size={18} /></Dialog.Close>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2"><IssueBadge issue={action.issue_type} /><UrgencyBadge urgency={action.urgency} /><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{formatRm(action.rm_at_risk)} estimate</span></div>
        <div className="mt-6 grid grid-cols-2 gap-3"><InfoItem label="Station ID" value={action.station_id} /><InfoItem label="Charger ID" value={action.charger_id ?? "Station-wide"} /><InfoItem label="Recommended rank" value={`#${action.rank}`} /><InfoItem label="Deadline" value={formatDeadline(action.deadline)} /></div>
        <div className="mt-6"><ActionRecommendation action={action} /></div>
        <section className="mt-7"><h3 className="text-sm font-semibold">Why this matters</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{action.reason}</p></section>
        <section className="mt-7"><h3 className="text-sm font-semibold">Related information</h3><div className="mt-3 grid gap-2"><Link to={`/stations/${action.station_id}`} className="flex items-center justify-between rounded-xl border border-border px-3 py-3 text-sm font-semibold hover:bg-muted">Open station details <ExternalLink size={15} /></Link>{action.charger_id && <><Link to={`/chargers/${action.charger_id}`} className="flex items-center justify-between rounded-xl border border-border px-3 py-3 text-sm font-semibold hover:bg-muted">Open charger health <ExternalLink size={15} /></Link><Link to={`/what-if?station=${action.station_id}&charger=${action.charger_id}`} className="flex items-center justify-between rounded-xl border border-border px-3 py-3 text-sm font-semibold hover:bg-muted">Open what-if simulator <ExternalLink size={15} /></Link></>}</div></section>
        <section className="mt-7 border-t border-border pt-5"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Action state</h3><p className="mt-1 text-xs text-muted-foreground">Status is stored locally for this session.</p></div><UserRound className="text-muted-foreground" size={18} /></div><div className="mt-3 grid grid-cols-3 gap-2">{(["pending", "assigned", "completed"] as ActionStatus[]).map((value) => <button key={value} type="button" onClick={() => onStatusChange(value)} className={`rounded-xl border px-2 py-2 text-xs font-semibold capitalize transition ${status === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>{status === value && <Check className="mr-1 inline" size={13} />}{value}</button>)}</div></section>
        <Button className="mt-7 w-full" onClick={() => onOpenChange(false)}>Done <ArrowUpRight size={15} /></Button>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div>
}
