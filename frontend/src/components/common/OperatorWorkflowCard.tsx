import type { LucideIcon } from "lucide-react"
import { ChevronRight } from "lucide-react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

export type OperatorWorkflowStep = {
  step: string
  label: string
  description: string
  to: string
  icon: LucideIcon
}

export function OperatorWorkflowCard({ step }: { step: OperatorWorkflowStep }) {
  const Icon = step.icon

  return <Link to={step.to} className={cn("group flex min-h-32 min-w-0 items-start gap-3 rounded-2xl border border-primary/10 bg-brand-soft/55 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:p-5")}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-primary shadow-sm"><Icon size={18} /></span><span className="flex min-w-0 flex-1 flex-col"><span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">{step.step}</span><span className="mt-2 break-words text-sm font-semibold leading-5 text-foreground">{step.label}</span><span className="mt-1 break-words text-xs leading-5 text-muted-foreground">{step.description}</span></span><ChevronRight className="mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" size={16} /></Link>
}
