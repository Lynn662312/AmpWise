export type IssueType = "safety_fault" | "degraded" | "connector_fault" | "user_reported" | "congestion" | "chronic_undercapacity" | "underused"
export type Urgency = "critical" | "high" | "medium" | "low"
export type ActionStatus = "pending" | "assigned" | "completed"
export type ActionState = "open" | "assigned" | "done"
export type AdviceLanguage = "en" | "zh" | "ms"
export type AdviceSource = "llm" | "template"

export type ActionAdvice = {
  action_id: string
  summary: string
  steps: string[]
  caveats: string[]
  source: AdviceSource
  cached: boolean
}

export type Action = {
  id: string
  rank: number
  station_name: string
  issue_type: IssueType
  station_id: string
  charger_id: string | null
  recommended_action: string
  rm_at_risk: number
  deadline: string | null
  urgency: Urgency
  reason: string
  report_count: number
  first_reported_at: string | null
  state: ActionState
}
