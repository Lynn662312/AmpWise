import { BellOff, Check } from "lucide-react"
import { isApiMode } from "@/services/api-client"
import { useNotifications } from "@/features/notifications/context/NotificationContext"
import { NotificationItem } from "@/features/notifications/components/NotificationItem"

export function NotificationPopover({ id, onClose }: { id: string; onClose: () => void }) {
  const { notifications, unreadCount, readIds, markAsRead, markAllRead, triggerDemoCriticalAlert } = useNotifications()

  return <div id={id} role="dialog" aria-label="Notifications" className="fixed inset-x-3 top-20 z-[1000] max-h-[70vh] overflow-hidden rounded-[1.5rem] border border-border bg-popover text-popover-foreground shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:max-h-[480px] sm:w-[min(26rem,calc(100vw-2rem))]">
    <div className="flex items-center justify-between gap-3 border-b border-border p-4">
      <div><p className="text-sm font-semibold">Notifications</p><p className="mt-0.5 text-xs text-muted-foreground">{unreadCount ? `${unreadCount} unread` : "All caught up"}</p></div>
      {unreadCount > 0 && <button type="button" onClick={markAllRead} className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"><Check size={12} />Mark all read</button>}
    </div>
    <div className="max-h-[calc(70vh-4.5rem)] overflow-y-auto p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:max-h-[388px]">
      {notifications.length ? notifications.map((notification) => <NotificationItem key={notification.id} notification={notification} unread={!readIds.has(notification.id)} onOpen={() => { markAsRead(notification.id); onClose() }} />) : <div className="flex flex-col items-center gap-2 px-4 py-10 text-center"><BellOff className="text-muted-foreground" size={22} /><p className="text-sm font-semibold">You're all caught up.</p><p className="text-xs text-muted-foreground">No operational notifications right now.</p></div>}
    </div>
    {!isApiMode && <div className="border-t border-border p-3"><button type="button" onClick={triggerDemoCriticalAlert} className="w-full rounded-full bg-muted px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground">Trigger critical alert</button></div>}
  </div>
}
