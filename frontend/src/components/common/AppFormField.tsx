import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function AppFormField({ id, label, description, error, required, className, children }: {
  id: string
  label?: string
  description?: string
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}) {
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  return <div className={cn("space-y-1.5", className)}>
    {label && <label htmlFor={id} className="block text-xs font-semibold text-muted-foreground">{label}{required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}</label>}
    {children}
    {description && <p id={descriptionId} className="text-[11px] leading-4 text-muted-foreground">{description}</p>}
    {error && <p id={errorId} className="text-[11px] leading-4 text-destructive" role="alert">{error}</p>}
  </div>
}

export function fieldDescribedBy(id: string, description?: string, error?: string) {
  return [description && `${id}-description`, error && `${id}-error`].filter(Boolean).join(" ") || undefined
}
