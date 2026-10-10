import { useEffect, useId, useRef, useState } from "react"
import { Bell } from "lucide-react"
import { useNotifications } from "@/features/notifications/context/NotificationContext"
import { NotificationPopover } from "@/features/notifications/components/NotificationPopover"
import { cn } from "@/lib/utils"

export function NotificationBell() {
  const { unreadCount, emergency } = useNotifications()
  const [open, setOpen] = useState(false)
  const [ring, setRing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!emergency) return
    setRing(true)
    const timeout = window.setTimeout(() => setRing(false), 700)
    return () => window.clearTimeout(timeout)
  }, [emergency])

  useEffect(() => {
    if (!open) return
    const handlePointer = (event: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false) }
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", handlePointer)
    document.addEventListener("keydown", handleKey)
    return () => { document.removeEventListener("mousedown", handlePointer); document.removeEventListener("keydown", handleKey) }
  }, [open])

  return <div ref={containerRef} className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog" aria-controls={panelId} title="Notifications" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications, no unread"} className={cn("relative rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground", ring && "motion-safe:animate-[bell-ring_0.6s_ease-in-out]")}>
      <Bell size={19} />
      {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-primary-foreground">{unreadCount > 9 ? "9+" : unreadCount}</span>}
    </button>
    {open && <NotificationPopover id={panelId} onClose={() => setOpen(false)} />}
  </div>
}
