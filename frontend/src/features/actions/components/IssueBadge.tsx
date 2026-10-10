import type { IssueType } from "@/features/actions/types"
import { issueConfig } from "@/features/actions/config/issueConfig"
import { cn } from "@/lib/utils"

export function IssueBadge({ issue, compact = false }: { issue: IssueType; compact?: boolean }) {
  const config = issueConfig[issue]
  const Icon = config.icon
  const colorClass = { critical: "bg-destructive/15 text-destructive", high: "bg-warning/15 text-warning", medium: "bg-warning/10 text-warning", low: "bg-muted text-muted-foreground" }[config.color]
  return <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", compact && "text-[10px]", colorClass)}><Icon size={compact ? 12 : 14} /><span className="truncate">{config.label}</span></span>
}
