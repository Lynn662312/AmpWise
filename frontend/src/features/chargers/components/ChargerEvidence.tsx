import { ClipboardList, MessageCircleWarning, Radio } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useActions } from "@/features/actions/hooks/useActions"
import { useChargerEvents } from "@/features/chargers/hooks/useChargerEvents"
import type { ChargerHealth } from "@/features/chargers/types"
import { cn } from "@/lib/utils"

// Event times are already in the station's local time, so the clock is read straight from the text.
function formatEventTime(iso: string) {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`
}

/** Why this charger is on the action list: the reason, what its sensors say, and its log. */
export function ChargerEvidence({ chargerId, health }: { chargerId: string; health: ChargerHealth | undefined }) {
  const { data: actionData } = useActions()
  const events = useChargerEvents(chargerId)
  const reasons = (actionData?.actions ?? []).filter((action) => action.charger_id === chargerId)
  const log = events.data ?? []

  return <Card className="p-5 sm:p-6">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><ClipboardList size={18} /></span>
      <div>
        <h2 className="font-display text-3xl font-semibold">Why this charger is flagged</h2>
        <p className="mt-1 text-xs text-muted-foreground">The reason, the sensor evidence and the log behind it, up to the selected time.</p>
      </div>
    </div>

    <div className="mt-5 space-y-2">
      {reasons.length ? reasons.map((action) => <p key={action.id} className="rounded-2xl bg-muted p-4 text-sm leading-6">{action.reason}</p>)
        : <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">This charger is not on the action list at the selected time.</p>}
    </div>

    {Boolean(health?.evidence.length) && <div className="mt-5">
      <h3 className="text-sm font-semibold">Sensor evidence</h3>
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        {health?.evidence.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{item}</li>)}
      </ul>
    </div>}

    <div className="mt-5">
      <h3 className="text-sm font-semibold">Log, last 14 days</h3>
      {events.isLoading ? <div className="mt-2 h-24 animate-pulse rounded-2xl bg-muted" />
        : events.isError ? <p className="mt-2 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">The log is currently unavailable.</p>
        : log.length === 0 ? <p className="mt-2 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No fault message or driver report in this period.</p>
        : <ol className="mt-2 max-h-96 space-y-2 overflow-y-auto">
          {log.map((event) => <li key={`${event.time}-${event.message}`} className="flex items-start gap-3 rounded-2xl bg-muted p-3">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", event.source === "sensor" ? "bg-brand-soft text-primary" : "bg-warning/15 text-warning")}>
              {event.source === "sensor" ? <Radio size={15} /> : <MessageCircleWarning size={15} />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm">{event.message}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatEventTime(event.time)} · {event.source === "sensor" ? "Charger sensor" : "Driver"}</span>
            </span>
          </li>)}
        </ol>}
    </div>
  </Card>
}
