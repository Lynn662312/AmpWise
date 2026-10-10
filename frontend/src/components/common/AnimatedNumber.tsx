import { useCountUp } from "@/hooks/useCountUp"
import { cn } from "@/lib/utils"

export interface AnimatedNumberProps {
  value: number
  duration?: number
  delay?: number
  decimals?: number
  prefix?: string
  suffix?: string
  locale?: string
  animateOnView?: boolean
  className?: string
}

export function AnimatedNumber({ value, duration = 1000, delay = 0, decimals = 0, prefix = "", suffix = "", locale = "en-MY", animateOnView = true, className }: AnimatedNumberProps) {
  const invalid = !Number.isFinite(value)
  const count = useCountUp(invalid ? 0 : value, { duration, delay, animateOnView })
  const formatter = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: true })
  return <span ref={count.ref} className={cn("tabular-nums", className)}>{invalid ? "—" : `${prefix}${formatter.format(count.value)}${suffix}`}</span>
}
