import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, ClipboardCheck, RefreshCw, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSimulatedTime } from "@/context/TimeContext"
import { ActionCard } from "@/features/actions/components/ActionCard"
import { ActionDetailDrawer } from "@/features/actions/components/ActionDetailDrawer"
import { ActionKpiCards } from "@/features/actions/components/ActionKpiCards"
import { ActionTable } from "@/features/actions/components/ActionTable"
import { ActionToolbar, type ActionSort, type ActionStatusFilter } from "@/features/actions/components/ActionToolbar"
import { useActions } from "@/features/actions/hooks/useActions"
import type { Action, ActionStatus, IssueType, Urgency } from "@/features/actions/types"
import { matchesAction, toUiStatus } from "@/features/actions/utils/actionHelpers"
import { useMapStations } from "@/features/map/hooks/useMapStations"
import { resetDemo } from "@/services/action-service"
import { isApiMode } from "@/services/api-client"

export function ActionsPage() {
  const { selectedIsoTime } = useSimulatedTime()
  const { data, isLoading, isError, isFetching, refetch } = useActions()
  const { data: stationData } = useMapStations()
  const [search, setSearch] = useState("")
  const [issues, setIssues] = useState<IssueType[]>([])
  const [urgency, setUrgency] = useState<Urgency | "all">("all")
  const [status, setStatus] = useState<ActionStatusFilter>("active")
  const [sort, setSort] = useState<ActionSort>("recommended")
  const [selectedAction, setSelectedAction] = useState<Action | null>(null)
  const [statuses, setStatuses] = useState<Record<string, ActionStatus>>({})
  const actions = data?.actions ?? []
  const stations = stationData?.stations ?? []
  const statusSyncEnabled = isApiMode && import.meta.env.VITE_ACTION_STATUS_ENABLED === "true"
  const queryClient = useQueryClient()
  // A saved state changes the station numbers too (a charger marked done works again), so everything is reloaded.
  const reload = () => void queryClient.invalidateQueries()
  const reset = useMutation({ mutationFn: resetDemo, onSuccess: () => { setStatuses({}); reload() } })
  const confirmReset = () => { if (window.confirm("Reset the demo? Every action becomes open again and the saved what-if runs are removed.")) reset.mutate() }

  const filteredActions = useMemo(() => actions.filter((action) => {
    const currentStatus = statuses[action.id] ?? toUiStatus(action.state)
    const matchesStatus = status === "all" || (status === "completed" ? currentStatus === "completed" : currentStatus !== "completed")
    return matchesStatus && matchesAction(action, search, issues, urgency, stations)
  }).sort((a, b) => {
    if (sort === "risk-desc") return b.rm_at_risk - a.rm_at_risk
    if (sort === "risk-asc") return a.rm_at_risk - b.rm_at_risk
    if (sort === "deadline") return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999")
    if (sort === "station") return a.station_name.localeCompare(b.station_name)
    return a.rank - b.rank
  }), [actions, issues, search, sort, stations, statuses, status, urgency])

  const clearFilters = () => {
    setSearch("")
    setIssues([])
    setUrgency("all")
    setStatus("active")
    setSort("recommended")
  }
  const selectedStatus = selectedAction ? statuses[selectedAction.id] ?? toUiStatus(selectedAction.state) : "pending"

  return <div className="space-y-6 pb-4">
    <section className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
      <div><h1 className="font-display text-[1.75rem] font-semibold leading-none tracking-tight sm:text-[2.25rem] lg:text-[2.5rem]">Action Center</h1><p className="mt-2 text-sm text-muted-foreground sm:text-base">Prioritize issues. Protect charging availability.</p></div>
      <div className="flex items-center gap-2">{statusSyncEnabled && <Button variant="soft" className="h-10 px-4 text-xs" onClick={confirmReset} disabled={reset.isPending} title="Open every action again and remove the saved what-if runs"><RotateCcw size={14} />{reset.isPending ? "Resetting…" : "Reset demo"}</Button>}<Button variant="soft" className="size-10 rounded-full p-0" onClick={() => void refetch()} disabled={isFetching} title="Refresh actions" aria-label="Refresh actions"><RefreshCw className={isFetching ? "animate-spin" : ""} size={15} /></Button></div>
    </section>
    {reset.isError && <p className="text-xs text-warning" role="alert">Demo reset unavailable. {reset.error instanceof Error ? reset.error.message : ""}</p>}
    <ActionKpiCards actions={filteredActions} selectedIsoTime={selectedIsoTime} loading={isLoading} />
    <ActionToolbar search={search} issues={issues} urgency={urgency} status={status} sort={sort} count={filteredActions.length} onSearchChange={setSearch} onIssuesChange={setIssues} onUrgencyChange={setUrgency} onStatusChange={setStatus} onSortChange={setSort} onClear={clearFilters} />
    {isError
      ? <StatePanel title="Action feed unavailable" description="Try refreshing the action feed." action="Try again" onAction={() => void refetch()} />
      : isLoading
        ? <LoadingState />
        : !filteredActions.length
          ? (actions.length
              ? <StatePanel title="No matching actions" description="Try another status or clear the filters." action="Clear filters" onAction={clearFilters} />
              : <StatePanel title="No California actions yet" description="No operational issues have been recorded for California stations." action="Refresh" onAction={() => void refetch()} />)
          : <><ActionTable actions={filteredActions} stations={stations} statuses={statuses} onSelect={setSelectedAction} /><div className="space-y-3 lg:hidden">{filteredActions.map((action) => <ActionCard key={action.id} action={action} status={statuses[action.id] ?? toUiStatus(action.state)} onSelect={() => setSelectedAction(action)} />)}</div></>}
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><ClipboardCheck size={14} className="text-primary" />Safety issues are surfaced before financial ranking. Revenue figures are estimates, not confirmed lost revenue.</div>
    <ActionDetailDrawer action={selectedAction} stations={stations} status={selectedStatus} statusSyncEnabled={statusSyncEnabled} open={Boolean(selectedAction)} onOpenChange={(open) => { if (!open) setSelectedAction(null) }} onStatusChange={(nextStatus) => { if (selectedAction) setStatuses((current) => ({ ...current, [selectedAction.id]: nextStatus })); if (statusSyncEnabled) reload() }} />
  </div>
}

function LoadingState() {
  return <div className="space-y-3" aria-label="Loading actions" aria-busy="true">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-[1.35rem] bg-muted" />)}</div>
}

function StatePanel({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) {
  return <div className="grid min-h-64 place-items-center rounded-[1.35rem] border border-dashed border-border bg-muted/35 p-8 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-card text-primary"><AlertCircle size={21} /></span><p className="mt-4 text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p><Button className="mt-4" variant="soft" onClick={onAction}>{action}</Button></div></div>
}
