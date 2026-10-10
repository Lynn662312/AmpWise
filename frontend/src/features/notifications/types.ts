import type { IssueType, Urgency } from "@/features/actions/types"

export type NotificationSeverity = Urgency
export type NotificationSource = "mock" | "api" | "simulated-demo"

export type Notification = {
  id: string
  severity: NotificationSeverity
  issueType: IssueType
  title: string
  message: string
  recommendedAction: string | null
  stationId: string | null
  chargerId: string | null
  stationName: string
  deadline: string | null
  source: NotificationSource
}
