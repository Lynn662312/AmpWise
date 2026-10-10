import { CheckCircle2, ScanSearch } from "lucide-react"
import { Card } from "@/components/ui/card"
import { MetricInfoPopover } from "@/features/results/components/MetricInfoPopover"
import type { BacktestResult } from "@/features/results/types"
import { formatPercent } from "@/features/results/utils/resultsHelpers"

const metrics = [
  { key: "precision", label: "Precision", icon: CheckCircle2, description: "Of the chargers flagged as faulty, how many were actually faulty?" },
  { key: "recall", label: "Recall", icon: ScanSearch, description: "Of the chargers that were actually faulty, how many did the detector identify?" },
] as const

export function FaultDetectionMetrics({ result }: { result: BacktestResult }) {
  const values = { precision: result.fault_precision, recall: result.fault_recall }
  return <Card className="p-5 sm:p-6"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Charger health</p><h2 className="mt-2 font-display text-3xl font-semibold">Charger Fault Detection</h2></div><div className="mt-6 space-y-5">{metrics.map(({ key, label, icon: Icon, description }) => <div key={key}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Icon size={17} className="text-primary" /><span className="text-sm font-semibold">{label}</span><MetricInfoPopover label={label}>{description}</MetricInfoPopover></div><span className="font-display text-2xl font-semibold">{formatPercent(values[key])}</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(Math.max(values[key] <= 1 ? values[key] * 100 : values[key], 0), 100)}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{description}</p></div>)}</div></Card>
}
