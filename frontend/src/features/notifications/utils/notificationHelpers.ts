import type { Action } from "@/features/actions/types"
import type { ChargingStation } from "@/features/map/types"
import { issueConfig } from "@/features/actions/config/issueConfig"
import { resolveStationName } from "@/features/actions/utils/actionHelpers"
import { getMockChargers } from "@/services/mockService"
import type { Notification, NotificationSource } from "@/features/notifications/types"

export function buildNotificationId(action: Action) {
  return `${action.station_id}__${action.charger_id ?? "station"}__${action.issue_type}`
}

export function mapActionsToNotifications(actions: readonly Action[], stations: readonly ChargingStation[], source: NotificationSource): Notification[] {
  return actions.map((action) => ({
    id: buildNotificationId(action),
    severity: action.urgency,
    issueType: action.issue_type,
    title: issueConfig[action.issue_type].label,
    message: action.reason,
    recommendedAction: action.recommended_action,
    stationId: action.station_id,
    chargerId: action.charger_id,
    stationName: resolveStationName(action.station_id, stations),
    deadline: action.deadline,
    source,
  }))
}

export function resolveNotificationRoute(notification: Notification, stations: readonly ChargingStation[]) {
  const station = stations.find(({ id }) => id === notification.stationId)
  if (notification.chargerId && station && getMockChargers(station).some(({ id }) => id === notification.chargerId)) return `/chargers/${notification.chargerId}`
  if (station) return `/stations/${station.id}`
  return "/actions"
}
