export type IssueType = "safety_fault" | "degraded" | "connector_fault" | "congestion" | "chronic_undercapacity" | "underused"
export type Urgency = "critical" | "high" | "medium" | "low"
export type ActionStatus = "pending" | "assigned" | "completed"

export type Action = {
  rank: number
  issue_type: IssueType
  station_id: string
  charger_id: string | null
  recommended_action: string
  rm_at_risk: number
  deadline: string | null
  urgency: Urgency
  reason: string
}
