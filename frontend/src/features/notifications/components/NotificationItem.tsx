import { useNavigate } from "react-router-dom"
import { issueConfig } from "@/features/actions/config/issueConfig"
import { formatDeadline } from "@/features/actions/utils/actionHelpers"
import { resolveNotificationRoute } from "@/features/notifications/utils/notificationHelpers"
import { useNotifications } from "@/features/notifications/context/NotificationContext"
import type { Notification } from "@/features/notifications/types"
import { cn } from "@/lib/utils"

const severityClass: Record<Notification["severity"], string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-warning/15 text-warning",
  medium: "bg-warning/10 text-warning",
  low: "bg-muted text-muted-foreground",
}

export function NotificationItem({ notification, unread, onOpen }: { notification: Notification; unread: boolean; onOpen: () => void }) {
  const navigate = useNavigate()
  const { stations } = useNotifications()
  const Icon = issueConfig[notification.issueType].icon

  return <button type="button" onClick={() => { onOpen(); navigate(resolveNotificationRoute(notification, stations)) }} className="flex w-full items-start gap-3 rounded-2xl p-3 text-left transition hover:bg-muted">
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", severityClass[notification.severity])}><Icon size={16} /></span>
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{notification.title}</span>{unread && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />}</span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{notification.message}</span>
      <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground"><span className="font-medium text-foreground">{notification.stationName}</span>{notification.chargerId && <span>· {notification.chargerId}</span>}<span>· {formatDeadline(notification.deadline)}</span></span>
    </span>
  </button>
}
