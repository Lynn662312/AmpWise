import type { Urgency } from "@/features/actions/types"
import { cn } from "@/lib/utils"

const urgencyLabels: Record<Urgency, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" }

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const className = { critical: "bg-destructive text-primary-foreground", high: "bg-warning text-primary-foreground", medium: "bg-warning/15 text-warning", low: "bg-muted text-muted-foreground" }[urgency]
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", className)}>{urgencyLabels[urgency]}</span>
}
