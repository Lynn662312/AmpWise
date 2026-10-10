import { useMemo, useState } from "react"
import { AlertCircle, ClipboardCheck, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSimulatedTime } from "@/context/TimeContext"
import { getMockStations } from "@/services/mockService"
import { ActionCard } from "@/features/actions/components/ActionCard"
import { ActionDetailDrawer } from "@/features/actions/components/ActionDetailDrawer"
import { ActionKpiCards } from "@/features/actions/components/ActionKpiCards"
import { ActionTable } from "@/features/actions/components/ActionTable"
import { ActionToolbar, type ActionSort } from "@/features/actions/components/ActionToolbar"
import { useActions } from "@/features/actions/hooks/useActions"
import type { Action, ActionStatus, IssueType, Urgency } from "@/features/actions/types"
import { getRecommendedActionSort, matchesAction } from "@/features/actions/utils/actionHelpers"

export function ActionsPage() {
  const { selectedTime } = useSimulatedTime()
  const { data, isLoading, isError, isFetching, refetch } = useActions()
  const [search, setSearch] = useState("")
  const [issues, setIssues] = useState<IssueType[]>([])
  const [urgency, setUrgency] = useState<Urgency | "all">("all")
  const [sort, setSort] = useState<ActionSort>("recommended")
  const [selectedAction, setSelectedAction] = useState<Action | null>(null)
  const [statuses, setStatuses] = useState<Record<number, ActionStatus>>({})
  const actions = data?.actions ?? []
  const stations = useMemo(() => getMockStations(selectedTime), [selectedTime])
  const filteredActions = useMemo(() => actions.filter((action) => matchesAction(action, search, issues, urgency, stations)).sort((a, b) => {
    if (sort === "risk-desc") return b.rm_at_risk - a.rm_at_risk
    if (sort === "risk-asc") return a.rm_at_risk - b.rm_at_risk
    if (sort === "deadline") return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999")
    if (sort === "station") return a.station_id.localeCompare(b.station_id)
    return getRecommendedActionSort(a, b)
  }), [actions, issues, search, sort, stations, urgency])
  const clearFilters = () => { setSearch(""); setIssues([]); setUrgency("all"); setSort("recommended") }
  const selectAction = (action: Action) => setSelectedAction(action)

  return <div className="space-y-6 pb-4"><section className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><h1 className="font-display text-[1.75rem] font-semibold leading-none tracking-tight sm:text-[2.25rem] lg:text-[2.5rem]">Action Center</h1><p className="mt-2 text-sm text-muted-foreground sm:text-base">Prioritize issues. Protect charging availability.</p></div><div className="flex items-center gap-2"><Button variant="soft" className="size-10 rounded-full p-0" onClick={() => void refetch()} disabled={isFetching} title="Refresh actions" aria-label="Refresh actions"><RefreshCw className={isFetching ? "animate-spin" : ""} size={15} /></Button></div></section><ActionKpiCards actions={filteredActions} selectedTime={selectedTime} loading={isLoading} /><ActionToolbar search={search} issues={issues} urgency={urgency} sort={sort} count={filteredActions.length} onSearchChange={setSearch} onIssuesChange={setIssues} onUrgencyChange={setUrgency} onSortChange={setSort} onClear={clearFilters} />{isError ? <StatePanel title="Action feed unavailable" description="Try refreshing the action feed." action="Try again" onAction={() => void refetch()} /> : isLoading ? <LoadingState /> : !filteredActions.length ? <StatePanel title="No matching actions" description="Clear the filters to restore the recommended action queue." action="Clear filters" onAction={clearFilters} /> : <><ActionTable actions={filteredActions} stations={stations} statuses={statuses} onSelect={selectAction} /><div className="space-y-3 lg:hidden">{filteredActions.map((action) => <ActionCard key={`${action.rank}-${action.station_id}-${action.charger_id}`} action={action} stations={stations} status={statuses[action.rank] ?? "pending"} onSelect={() => selectAction(action)} />)}</div></>}<div className="flex items-center gap-2 text-xs text-muted-foreground"><ClipboardCheck size={14} className="text-primary" />Safety issues are surfaced before financial ranking. Revenue figures are estimates, not confirmed lost revenue.<ActionDetailDrawer action={selectedAction} stations={stations} status={selectedAction ? statuses[selectedAction.rank] ?? "pending" : "pending"} open={Boolean(selectedAction)} onOpenChange={(open) => { if (!open) setSelectedAction(null) }} onStatusChange={(status) => { if (selectedAction) setStatuses((current) => ({ ...current, [selectedAction.rank]: status })) }} /></div>
  </div>
}

function LoadingState() {
  return <div className="space-y-3" aria-label="Loading actions" aria-busy="true">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-[1.35rem] bg-muted" />)}</div>
}

function StatePanel({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) {
  return <div className="grid min-h-64 place-items-center rounded-[1.35rem] border border-dashed border-border bg-muted/35 p-8 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-card text-primary"><AlertCircle size={21} /></span><p className="mt-4 text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p><Button className="mt-4" variant="soft" onClick={onAction}>{action}</Button></div></div>
}
