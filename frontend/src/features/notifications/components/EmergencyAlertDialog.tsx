import * as Dialog from "@radix-ui/react-dialog"
import { useNavigate } from "react-router-dom"
import { ShieldAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDeadline } from "@/features/actions/utils/actionHelpers"
import { resolveNotificationRoute } from "@/features/notifications/utils/notificationHelpers"
import { useNotifications } from "@/features/notifications/context/NotificationContext"

export function EmergencyAlertDialog() {
  const { emergency, stations, dismissEmergency } = useNotifications()
  const navigate = useNavigate()
  if (!emergency) return null
  const label = emergency.source === "api" ? "Predicted Safety Risk" : "Critical Safety Alert"

  return <Dialog.Root open onOpenChange={(open) => { if (!open) dismissEmergency() }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[1100] bg-primary/30 backdrop-blur-[2px]" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-[1101] w-[min(440px,calc(100vw-2rem))] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[1.5rem] border border-destructive/30 bg-card p-5 shadow-2xl outline-none sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-destructive/15 text-destructive"><ShieldAlert size={21} /></span><div><Dialog.Title className="font-display text-xl font-semibold leading-none">Critical Charger Alert</Dialog.Title><Dialog.Description className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-destructive">{label}</Dialog.Description></div></div>
          <Dialog.Close className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Dismiss alert"><X size={17} /></Dialog.Close>
        </div>
        <div className="mt-5 space-y-3 text-sm">
          <Row label="Station" value={emergency.stationName} />
          <Row label="Charger" value={emergency.chargerId ?? "Station-wide"} />
          <Row label="Detected issue" value={emergency.title} />
          <Row label="Reason" value={emergency.message} />
          {emergency.recommendedAction && <Row label="Recommended action" value={emergency.recommendedAction} />}
          <Row label="Deadline" value={formatDeadline(emergency.deadline)} />
        </div>
        <div className="mt-6 flex gap-2">
          <Button variant="forest" className="flex-1" onClick={() => { const route = resolveNotificationRoute(emergency, stations); dismissEmergency(); navigate(route) }}>View Charger</Button>
          <Button variant="soft" className="flex-1" onClick={dismissEmergency}>Dismiss</Button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><span className="shrink-0 text-xs font-semibold text-muted-foreground">{label}</span><span className="max-w-[65%] text-right font-medium">{value}</span></div>
}
