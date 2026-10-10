import { ClipboardList } from "lucide-react"
import { Card } from "@/components/ui/card"
import { issueConfig } from "@/features/actions/config/issueConfig"
import { useActions } from "@/features/actions/hooks/useActions"
import { getCurrencyCode } from "@/lib/simulationConfig"

/** Why this station needs attention: its open actions with the backend's reason for each. */
export function StationActions({ stationId }: { stationId: string }) {
  const { data, isLoading, isError } = useActions()
  const actions = (data?.actions ?? []).filter((action) => action.station_id === stationId)

  return <Card className="p-5 sm:p-6">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><ClipboardList size={18} /></span>
      <div>
        <h2 className="font-display text-3xl font-semibold">Why this station needs attention</h2>
        <p className="mt-1 text-xs text-muted-foreground">Open actions here at the selected time, with the reason for each.</p>
      </div>
    </div>
    <div className="mt-5 space-y-2">
      {isLoading ? <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        : isError ? <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Actions are currently unavailable.</p>
        : actions.length === 0 ? <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No open action at this station at the selected time.</p>
        : actions.map((action) => <div key={action.id} className="rounded-2xl bg-muted p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">#{action.rank} · {issueConfig[action.issue_type]?.label ?? action.issue_type}{action.charger_id ? ` · ${action.charger_id}` : ""}</p>
            <span className="text-xs font-semibold text-muted-foreground">{getCurrencyCode()} {Math.round(action.rm_at_risk).toLocaleString("en-US")} estimated at risk</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.reason}</p>
        </div>)}
    </div>
  </Card>
}
