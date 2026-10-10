import type { ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { AnimatedNumber } from "@/components/common/AnimatedNumber"

export function MetricCard({ label, value, icon, tone = "text-primary", description, loading = false, prefix, suffix, decimals = 0, trailing }: { label: string; value: number | null; icon: ReactNode; tone?: string; description?: string; loading?: boolean; prefix?: string; suffix?: string; decimals?: number; trailing?: ReactNode }) {
  return <Card className="p-4 sm:p-5"><div className="flex items-center justify-between"><span className={`grid h-9 w-9 place-items-center rounded-xl bg-muted ${tone}`}>{icon}</span>{loading ? <span className="h-4 w-10 animate-pulse rounded bg-muted" /> : trailing}</div><p className="mt-4 text-xs font-medium text-muted-foreground sm:text-sm">{label}</p><p className="mt-1 font-display text-3xl font-semibold sm:text-4xl">{loading ? "—" : value === null ? "Unavailable" : <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />}</p>{description && <p className="mt-1 text-[10px] text-muted-foreground">{description}</p>}</Card>
}
