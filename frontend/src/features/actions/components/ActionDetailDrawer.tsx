import * as Dialog from "@radix-ui/react-dialog"
import { ArrowUpRight, Check, ExternalLink, LoaderCircle, MapPin, Sparkles, UserRound, X } from "lucide-react"
import { Link } from "react-router-dom"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AppSelect } from "@/components/common/AppSelect"
import type { Action, ActionAdvice, ActionStatus, AdviceLanguage } from "@/features/actions/types"
import type { ChargingStation } from "@/features/map/types"
import { issueConfig } from "@/features/actions/config/issueConfig"
import { formatDeadline, formatCurrency, formatReportedAt, resolveStationLocation } from "@/features/actions/utils/actionHelpers"
import { ActionRecommendation } from "@/features/actions/components/ActionRecommendation"
import { IssueBadge } from "@/features/actions/components/IssueBadge"
import { UrgencyBadge } from "@/features/actions/components/UrgencyBadge"
import { updateActionStatus } from "@/services/action-service"
import { useActionAdvice } from "@/features/actions/hooks/useActionAdvice"
import { isApiMode } from "@/services/api-client"
import { useMutation } from "@tanstack/react-query"

const languages: { value: AdviceLanguage; label: string }[] = [{ value: "en", label: "English" }, { value: "zh", label: "中文" }, { value: "ms", label: "Bahasa Melayu" }]

export function ActionDetailDrawer({ action, stations, status, statusSyncEnabled, open, onOpenChange, onStatusChange }: { action: Action | null; stations: readonly ChargingStation[]; status: ActionStatus; statusSyncEnabled: boolean; open: boolean; onOpenChange: (open: boolean) => void; onStatusChange: (status: ActionStatus) => void }) {
  const [language, setLanguage] = useState<AdviceLanguage>("en")
  const advice = useActionAdvice(action?.id ?? "")
  const statusMutation = useMutation({
    mutationKey: ["action-status", action?.id ?? "none"],
    mutationFn: (next: ActionStatus) => updateActionStatus(action?.id ?? "", next === "completed" ? "done" : "assigned"),
  })
  if (!action) return null
  const config = issueConfig[action.issue_type]
  const stationName = action.station_name
  const reportDate = formatReportedAt(action.first_reported_at)
  const canChangeStatus = statusSyncEnabled || !isApiMode
  const requestAdvice = (nextLanguage: string) => { const next = nextLanguage as AdviceLanguage; setLanguage(next); advice.mutate({ language: next }) }

  const changeStatus = (next: ActionStatus) => {
    if (next === "pending") {
      if (!statusSyncEnabled && canChangeStatus) onStatusChange(next)
      return
    }
    if (statusSyncEnabled) statusMutation.mutate(next, { onSuccess: () => onStatusChange(next) })
    else if (canChangeStatus) onStatusChange(next)
  }
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Content className="action-details-drawer fixed inset-x-0 bottom-0 z-[var(--z-modal-content)] flex h-[80dvh] max-h-[80dvh] min-w-0 flex-col overflow-hidden rounded-t-[28px] rounded-b-none border border-border bg-card shadow-2xl outline-none md:inset-y-0 md:left-auto md:right-0 md:h-[100dvh] md:max-h-[100dvh] md:w-[min(520px,100vw)] md:rounded-l-[28px] md:rounded-r-none md:border-y-0 md:border-r-0">
    <div className="shrink-0 border-b border-border/70 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-7 md:pb-5 md:pt-7"><div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted md:hidden" /><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Action #{action.rank} · {config.category}</p><Dialog.Title className="mt-2 break-words font-display text-3xl font-semibold leading-[0.95] md:text-4xl">{config.label}</Dialog.Title><Dialog.Description className="mt-3 flex min-w-0 items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 shrink-0" size={15} /><span className="break-words">{stationName} · {resolveStationLocation(action.station_id, stations)}</span></Dialog.Description></div><Dialog.Close className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground" aria-label="Close action details"><X size={18} /></Dialog.Close></div><div className="mt-4 flex flex-wrap items-center gap-2"><IssueBadge issue={action.issue_type} /><UrgencyBadge urgency={action.urgency} /><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{formatCurrency(action.rm_at_risk)} estimate</span></div></div>
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-6"><div className="grid grid-cols-2 gap-3"><InfoItem label="Station ID" value={action.station_id} /><InfoItem label="Charger ID" value={action.charger_id ?? "Station-wide"} /><InfoItem label="Recommended rank" value={`#${action.rank}`} /><InfoItem label="Deadline" value={formatDeadline(action.deadline)} /></div>{action.report_count > 0 && <p className="mt-4 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">{action.report_count} driver report{action.report_count === 1 ? "" : "s"}{reportDate ? ` · first reported ${reportDate}` : ""}{action.issue_type === "user_reported" ? ". Sensors have not identified a confirmed fault." : "."}</p>}{action.reason && <section className="mt-6"><h3 className="text-sm font-semibold">Why this is on the list</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{action.reason}</p></section>}<div className="mt-6"><ActionRecommendation action={action} /></div><section className="mt-6 rounded-2xl bg-muted p-4"><div className="flex flex-col gap-3 min-[380px]:flex-row min-[380px]:items-start min-[380px]:justify-between"><div className="min-w-0"><h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} className="text-primary" />AI advice</h3><p className="mt-1 text-xs text-muted-foreground">Generate guidance only when requested.</p></div><AppSelect aria-label="Advice language" value={language} onValueChange={requestAdvice} options={languages} size="sm" className="w-full min-[380px]:w-32" /></div><Button variant="soft" className="mt-4 w-full" onClick={() => requestAdvice(language)} disabled={advice.isPending}><span>{advice.isPending ? <LoaderCircle className="animate-spin" size={15} /> : <Sparkles size={15} />}</span>{advice.isPending ? "Preparing advice…" : "Get advice"}</Button>{advice.isError && <p className="mt-3 break-words text-xs text-warning">Advice currently unavailable. {advice.error instanceof Error ? advice.error.message : "The advice endpoint returned an error."}</p>}{advice.data && <AdviceContent advice={advice.data} />}</section><section className="mt-7"><h3 className="text-sm font-semibold">Related information</h3><Link to={`/stations/${encodeURIComponent(action.station_id)}`} className="mt-3 flex items-center justify-between rounded-xl border border-border px-3 py-3 text-sm font-semibold hover:bg-muted">Open station details <ExternalLink size={15} /></Link></section><section className="mt-7 border-t border-border pt-5"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><h3 className="text-sm font-semibold">Action state</h3><p className="mt-1 text-xs text-muted-foreground">{statusSyncEnabled ? "Synced with the backend. Completed actions remain available from the status filter." : "Demo-only local state; backend status route is not enabled."}</p></div><UserRound className="shrink-0 text-muted-foreground" size={18} /></div><div className="mt-3 grid grid-cols-3 gap-2">{(["pending", "assigned", "completed"] as ActionStatus[]).map((value) => <button key={value} type="button" disabled={!canChangeStatus || (statusSyncEnabled && value === "pending")} onClick={() => changeStatus(value)} className={`min-w-0 rounded-xl border px-1 py-2 text-[11px] font-semibold capitalize transition md:px-2 md:text-xs ${status === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"} disabled:cursor-not-allowed disabled:opacity-50`}>{status === value && <Check className="mr-1 inline" size={13} />}{value}</button>)}</div>{statusMutation.isError && <p className="mt-2 break-words text-xs text-warning">Status update unavailable. {statusMutation.error instanceof Error ? statusMutation.error.message : "The backend status route returned an error."}</p>}</section></div>
    <div className="shrink-0 border-t border-border/70 bg-card px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:px-7 md:pb-6"><Button className="w-full" onClick={() => onOpenChange(false)}>Done <ArrowUpRight size={15} /></Button></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>
}

function InfoItem({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-border p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div> }

function AdviceContent({ advice }: { advice: ActionAdvice }) { return <div className="mt-4 space-y-3 border-t border-border/70 pt-4"><p className="text-sm leading-6">{advice.summary}</p>{advice.steps.length > 0 && <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Steps</p><ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5">{advice.steps.map((step) => <li key={step}>{step}</li>)}</ol></div>}{advice.caveats.length > 0 && <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Caveats</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">{advice.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul></div>}<p className="text-[11px] text-muted-foreground">Source: {advice.source === "llm" ? "AI model" : "template fallback"}{advice.cached ? " · cached" : ""}</p></div> }
