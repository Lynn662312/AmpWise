import { Card } from "@/components/ui/card"
import { MetricInfoPopover } from "@/features/results/components/MetricInfoPopover"
import type { BacktestResult } from "@/features/results/types"
import { formatNumber, getMaeReduction } from "@/features/results/utils/resultsHelpers"

export function ForecastAccuracyChart({ result }: { result: BacktestResult }) {
  const max = Math.max(result.forecast_mae_ours, result.forecast_mae_baseline, 1)
  const reduction = getMaeReduction(result.forecast_mae_ours, result.forecast_mae_baseline)
  const bars = [{ label: "Baseline forecast", value: result.forecast_mae_baseline, className: "bg-muted-foreground/45" }, { label: "AmpWise forecast", value: result.forecast_mae_ours, className: "bg-accent" }]
  return <Card className="p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Forecast accuracy</p><h2 className="mt-2 font-display text-3xl font-semibold">Congestion Forecast Accuracy</h2></div><MetricInfoPopover label="MAE">MAE means Mean Absolute Error: the average absolute difference between predicted and actual arrivals. Lower values are better.</MetricInfoPopover></div><div className="mt-6 space-y-5">{bars.map(({ label, value, className }) => <div key={label}><div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="font-medium">{label}</span><span className="font-display text-2xl font-semibold">{formatNumber(value)} <span className="font-sans text-xs font-medium text-muted-foreground">MAE</span></span></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${className}`} style={{ width: `${(value / max) * 100}%` }} /></div></div>)}</div><div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground"><span>Lower is better.</span><span className="font-semibold text-primary">{reduction === null ? "Comparison unavailable" : `${formatNumber(reduction)}% lower MAE`}</span></div></Card>
}
