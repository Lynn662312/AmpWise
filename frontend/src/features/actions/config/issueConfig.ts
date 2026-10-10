import { Activity, Gauge, PlugZap, ShieldAlert, TrafficCone, TrendingDown, type LucideIcon } from "lucide-react"
import type { IssueType } from "@/features/actions/types"

export const issueConfig: Record<IssueType, { label: string; description: string; category: string; icon: LucideIcon; color: string }> = {
  safety_fault: { label: "Safety fault", description: "Safety-related charger fault", category: "Safety", icon: ShieldAlert, color: "critical" },
  degraded: { label: "Degraded charger", description: "Reduced charger performance", category: "Health", icon: Activity, color: "high" },
  connector_fault: { label: "Connector fault", description: "Connector or cable issue", category: "Health", icon: PlugZap, color: "high" },
  congestion: { label: "Congestion", description: "Predicted charging demand pressure", category: "Demand", icon: TrafficCone, color: "medium" },
  chronic_undercapacity: { label: "Chronic undercapacity", description: "Recurring demand above available capacity", category: "Planning", icon: Gauge, color: "medium" },
  underused: { label: "Underused station", description: "Station usage below expected demand", category: "Planning", icon: TrendingDown, color: "low" },
}

export const issueOptions = Object.entries(issueConfig) as [IssueType, (typeof issueConfig)[IssueType]][]
