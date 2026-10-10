import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useActions } from "@/features/actions/hooks/useActions"
import { useMapStations } from "@/features/map/hooks/useMapStations"
import { urgencyOrder } from "@/features/actions/utils/actionHelpers"
import { mapActionsToNotifications } from "@/features/notifications/utils/notificationHelpers"
import type { ChargingStation } from "@/features/map/types"
import type { Notification } from "@/features/notifications/types"

const READ_STORAGE_KEY = "ampwise-notifications-read"
const ACK_STORAGE_KEY = "ampwise-notifications-acknowledged"

function loadIdSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set()
  try { return new Set(JSON.parse(window.localStorage.getItem(key) ?? "[]") as string[]) } catch { return new Set() }
}

function saveIdSet(key: string, ids: Set<string>) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify([...ids]))
}

type NotificationContextValue = {
  notifications: Notification[]
  stations: ChargingStation[]
  unreadCount: number
  readIds: Set<string>
  emergency: Notification | null
  markAsRead: (id: string) => void
  markAllRead: () => void
  dismissEmergency: () => void
  triggerDemoCriticalAlert: () => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { data: actionsData } = useActions()
  const { data: stationsData } = useMapStations()
  const stations = stationsData?.stations ?? []

  const actionNotifications = useMemo(
    () => (actionsData ? mapActionsToNotifications(actionsData.actions.filter(({ urgency, issue_type }) => urgency === "critical" && (issue_type === "safety_fault" || issue_type === "user_reported")), stations, actionsData.source) : []),
    [actionsData, stations],
  )
  const [demoNotifications, setDemoNotifications] = useState<Notification[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(() => loadIdSet(READ_STORAGE_KEY))
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(() => loadIdSet(ACK_STORAGE_KEY))
  const [emergency, setEmergency] = useState<Notification | null>(null)
  const hasSeededRef = useRef(false)
  const shownThisSessionRef = useRef<Set<string>>(new Set())
  const demoCounterRef = useRef(0)

  const notifications = useMemo(
    () => [...demoNotifications, ...actionNotifications].sort((a, b) => urgencyOrder[a.severity] - urgencyOrder[b.severity]),
    [actionNotifications, demoNotifications],
  )

  // Seed the baseline on first load so pre-existing fixture data never fires the
  // emergency popup; only a critical notification that appears afterwards does.
  useEffect(() => {
    if (!actionNotifications.length) return
    if (!hasSeededRef.current) {
      hasSeededRef.current = true
      setAcknowledgedIds((current) => {
        const next = new Set(current)
        actionNotifications.filter((notification) => notification.severity === "critical").forEach((notification) => next.add(notification.id))
        saveIdSet(ACK_STORAGE_KEY, next)
        return next
      })
      return
    }
    const newCritical = actionNotifications.find((notification) => notification.severity === "critical" && !acknowledgedIds.has(notification.id) && !shownThisSessionRef.current.has(notification.id))
    if (newCritical) {
      shownThisSessionRef.current.add(newCritical.id)
      setEmergency(newCritical)
    }
  }, [actionNotifications, acknowledgedIds])

  const markAsRead = (id: string) => setReadIds((current) => {
    if (current.has(id)) return current
    const next = new Set(current).add(id)
    saveIdSet(READ_STORAGE_KEY, next)
    return next
  })

  const markAllRead = () => setReadIds(() => {
    const next = new Set(notifications.map((notification) => notification.id))
    saveIdSet(READ_STORAGE_KEY, next)
    return next
  })

  const dismissEmergency = () => {
    if (emergency) setAcknowledgedIds((current) => {
      const next = new Set(current).add(emergency.id)
      saveIdSet(ACK_STORAGE_KEY, next)
      return next
    })
    setEmergency(null)
  }

  const triggerDemoCriticalAlert = () => {
    demoCounterRef.current += 1
    const station = stations[0] ?? null
    const demoNotification: Notification = {
      id: `demo-critical-${demoCounterRef.current}`,
      severity: "critical",
      issueType: "safety_fault",
      title: "Critical Safety Alert",
      message: "A critical safety alert requires operator review.",
      recommendedAction: "Dispatch a technician to confirm charger safety status before resuming service.",
      stationId: station?.id ?? null,
      chargerId: station ? `${station.id}_c1` : null,
      stationName: station?.name ?? "Unknown station",
      deadline: null,
      source: "simulated-demo",
    }
    shownThisSessionRef.current.add(demoNotification.id)
    setDemoNotifications((current) => [demoNotification, ...current])
    setEmergency(demoNotification)
  }

  const unreadCount = notifications.filter((notification) => !readIds.has(notification.id)).length

  const value = useMemo(() => ({ notifications, stations, unreadCount, readIds, emergency, markAsRead, markAllRead, dismissEmergency, triggerDemoCriticalAlert }), [notifications, stations, unreadCount, readIds, emergency])

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider")
  return context
}
