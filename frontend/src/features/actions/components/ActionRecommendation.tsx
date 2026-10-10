import { ArrowRight, CircleAlert } from "lucide-react"
import { issueConfig } from "@/features/actions/config/issueConfig"
import type { Action } from "@/features/actions/types"
import { formatDeadline } from "@/features/actions/utils/actionHelpers"

export function ActionRecommendation({ action }: { action: Action }) {
  const Icon = issueConfig[action.issue_type].icon
  return <div className="rounded-2xl bg-muted p-4"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card text-primary"><Icon size={17} /></span><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recommended next step</p><p className="mt-1 text-sm font-semibold leading-6">{action.recommended_action}</p></div></div><div className="mt-4 flex items-center gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground"><CircleAlert size={14} className="text-warning" />Complete by <strong className="text-foreground">{formatDeadline(action.deadline)}</strong><ArrowRight size={14} className="ml-auto" /></div></div>
}
