import { useId, type ChangeEventHandler, type ComponentPropsWithoutRef, type ReactNode } from "react"
import { AppFormField, fieldDescribedBy } from "@/components/common/AppFormField"
import { cn } from "@/lib/utils"

export type AppFieldSize = "sm" | "default" | "lg"

type AppTextFieldProps = Omit<ComponentPropsWithoutRef<"input">, "className" | "id" | "size" | "value" | "onChange"> & {
  id?: string
  label?: string
  value?: string | number | readonly string[]
  onChange?: ChangeEventHandler<HTMLInputElement>
  description?: string
  error?: string
  startIcon?: ReactNode
  endIcon?: ReactNode
  size?: AppFieldSize
  className?: string
}

const sizeClasses: Record<AppFieldSize, string> = {
  sm: "h-9 text-xs",
  default: "h-11 text-sm",
  lg: "h-[52px] text-base",
}

export function AppTextField({ id, label, description, error, required, startIcon, endIcon, size = "default", className, value, onChange, ...props }: AppTextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? `app-text-${generatedId}`
  return <AppFormField id={fieldId} label={label} description={description} error={error} required={required} className={className}>
    <div className="relative">
      {startIcon && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground [&>svg]:size-4">{startIcon}</span>}
      <input {...props} id={fieldId} value={value} onChange={onChange} required={required} aria-invalid={error ? true : undefined} aria-describedby={fieldDescribedBy(fieldId, description, error)} className={cn("w-full rounded-xl border border-border bg-background px-3 font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-60", sizeClasses[size], startIcon && "pl-10", endIcon && "pr-10")} />
      {endIcon && <span className="absolute inset-y-0 right-3 flex items-center text-muted-foreground [&>svg]:size-4">{endIcon}</span>}
    </div>
  </AppFormField>
}
