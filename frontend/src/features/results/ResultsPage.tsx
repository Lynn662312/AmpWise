import { RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { evaluationWeeks } from "@/mocks/backtest"
import { isBacktestMockMode } from "@/services/backtest-service"
import { EvaluationWeekSelector } from "@/features/results/components/EvaluationWeekSelector"
import { FaultDetectionMetrics } from "@/features/results/components/FaultDetectionMetrics"
import { ForecastAccuracyChart } from "@/features/results/components/ForecastAccuracyChart"
import { ImpactSummary } from "@/features/results/components/ImpactSummary"
import { MethodologyAccordion } from "@/features/results/components/MethodologyAccordion"
import { StrategyComparison } from "@/features/results/components/StrategyComparison"
import { useBacktestResults } from "@/features/results/hooks/useBacktestResults"
import { cn } from "@/lib/utils"
import { useState } from "react"

export function ResultsPage() {
  const [week, setWeek] = useState(evaluationWeeks[0].value)
  const { data, isLoading, isError, isFetching, refetch } = useBacktestResults(week)

  return <div className="space-y-7 pb-6">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"><Sparkles size={14} className="text-primary" /> Evaluation workspace</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Results &amp; impact<span className="text-primary">.</span></h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">See how predictive maintenance and smarter charging decisions could improve network performance.</p></div><div className="flex items-center gap-2"><EvaluationWeekSelector weeks={evaluationWeeks} value={week} onChange={setWeek} /><Button variant="soft" onClick={() => void refetch()} disabled={isFetching} aria-label="Refresh evaluation results"><RefreshCw className={cn(isFetching && "animate-spin")} size={15} /><span className="hidden sm:inline">Refresh</span></Button></div></section>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span className="rounded-full bg-muted px-3 py-2 font-semibold">{isBacktestMockMode ? "Simulated evaluation data" : "Connected model evaluation"}</span><span>Lower MAE is better · revenue figures are estimates</span></div>
    {isLoading ? <LoadingState /> : isError || !data ? <ErrorState onRetry={() => void refetch()} /> : <><ImpactSummary result={data.result} source={data.source} /><StrategyComparison /><section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]"><ForecastAccuracyChart result={data.result} /><FaultDetectionMetrics result={data.result} /></section><MethodologyAccordion /></>}
  </div>
}

function LoadingState() {
  return <div className="space-y-4" aria-busy="true" aria-label="Loading evaluation results"><div className="h-72 animate-pulse rounded-[1.5rem] bg-muted" /><div className="grid gap-4 md:grid-cols-2"><div className="h-56 animate-pulse rounded-[1.5rem] bg-muted" /><div className="h-56 animate-pulse rounded-[1.5rem] bg-muted" /></div></div>
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <Card className="grid min-h-72 place-items-center p-8 text-center"><div><p className="text-sm font-semibold">Evaluation results are unavailable</p><p className="mt-1 text-xs text-muted-foreground">Check the backtest service and try again.</p><Button className="mt-4" variant="soft" onClick={onRetry}>Try again</Button></div></Card>
}
