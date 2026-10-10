import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[1.35rem] border border-border/70 bg-card text-card-foreground shadow-[0_12px_35px_color-mix(in_srgb,var(--primary)_6%,transparent)]", className)} {...props} />
}
