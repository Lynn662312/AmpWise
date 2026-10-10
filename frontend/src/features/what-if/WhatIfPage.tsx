import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Clock3, RefreshCw } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { DataSourceBadge } from "@/components/common/DataSourceBadge"
import { useSimulatedTime } from "@/context/TimeContext"
import { useMapStations } from "@/features/map/hooks/useMapStations"
import { ComparisonChart } from "@/features/what-if/components/ComparisonChart"
import { ImpactKpiCards } from "@/features/what-if/components/ImpactKpiCards"
import { MethodologyAccordion } from "@/features/what-if/components/MethodologyAccordion"
import { ScenarioConfigCard, type ScenarioForm } from "@/features/what-if/components/ScenarioConfigCard"
import { SimulationSummary } from "@/features/what-if/components/SimulationSummary"
import { useWhatIfSimulation } from "@/features/what-if/hooks/useWhatIfSimulation"
import { isWhatIfMockMode } from "@/services/what-if-service"
import { formatApiTime } from "@/features/what-if/utils/simulationHelpers"
import type { ScenarioType } from "@/features/what-if/types"

const defaultForm: ScenarioForm = { scenario: "fix_now", stationId: "", chargerId: "", repairTiming: "fix_now", additionalChargers: 2, discountPct: 10 }

export function WhatIfPage() {
  const { selectedTime, timeLabel } = useSimulatedTime()
  const { data: stationData, isLoading: stationsLoading } = useMapStations()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<ScenarioForm>(defaultForm)
  const [resultTime, setResultTime] = useState<number | null>(null)
  const simulation = useWhatIfSimulation()
  const stations = stationData?.stations ?? []
  const selectedStation = stations.find(({ id }) => id === form.stationId) ?? null

  useEffect(() => {
    if (!stations.length) return
    const requestedStation = searchParams.get("station")
    const stationId = stations.some(({ id }) => id === requestedStation) ? requestedStation ?? stations[0].id : form.stationId && stations.some(({ id }) => id === form.stationId) ? form.stationId : stations[0].id
    const requestedCharger = searchParams.get("charger") ?? ""
    setForm((current) => ({ ...current, stationId, chargerId: current.stationId === stationId ? current.chargerId || requestedCharger : requestedCharger }))
  }, [form.stationId, searchParams, stations])

  const updateForm = (next: Partial<ScenarioForm>) => setForm((current) => ({ ...current, ...next }))
  const reset = () => { setForm({ ...defaultForm, stationId: stations[0]?.id ?? "" }); simulation.reset(); setResultTime(null) }
  const runSimulation = () => simulation.mutate({ scenario: form.scenario, station_id: form.stationId, charger_id: form.scenario === "fix_now" ? form.chargerId : null, n_chargers: form.scenario === "add_chargers" ? form.additionalChargers : null, discount_pct: form.scenario === "discount" ? form.discountPct : null, time: formatApiTime(selectedTime), repair_timing: form.scenario === "fix_now" ? form.repairTiming : undefined }, { onSuccess: () => setResultTime(selectedTime) })
  const result = simulation.data
  const resultIsStale = resultTime !== null && resultTime !== selectedTime
  const scenarioLabel = useMemo(() => ({ fix_now: "Repair charger", add_chargers: "Add chargers", discount: "Off-peak discount" } satisfies Record<ScenarioType, string>)[form.scenario], [form.scenario])

  return <div className="space-y-6 pb-4"><section className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 text-sm font-medium text-muted-foreground">Malaysia Operations · {timeLabel}</p><div className="flex items-center gap-2"><h1 className="font-display text-5xl font-semibold tracking-tight sm:text-6xl">What-if Simulator<span className="text-accent">.</span></h1><MethodologyAccordion /></div><p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">Explore how operational decisions could reduce EV charging congestion and protect revenue.</p></div><div className="flex items-center gap-2"><DataSourceBadge mock={isWhatIfMockMode} mockLabel="Demo simulator · fake results" liveLabel="Live simulator · backend results" /><span className="inline-flex w-fit items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground"><Clock3 size={14} />{timeLabel}</span></div></section><section className="grid items-start gap-5 lg:grid-cols-[minmax(19rem,0.7fr)_minmax(0,1.3fr)]"><div className="space-y-4"><ScenarioConfigCard form={form} stations={stations} timeLabel={timeLabel} loading={simulation.isPending || stationsLoading} liveMode={!isWhatIfMockMode} onChange={updateForm} onRun={runSimulation} onReset={reset} /><div className="rounded-2xl border border-border bg-card p-4 text-xs leading-5 text-muted-foreground"><p className="font-semibold text-foreground">Current mode</p><p className="mt-1">{isWhatIfMockMode ? "Simulated demo data · deterministic results" : "Live API mode · backend results only"}</p></div></div><div className="min-w-0">{simulation.isPending && <div className="grid min-h-[420px] place-items-center rounded-[1.35rem] border border-border bg-card"><RefreshCw className="animate-spin text-primary" size={24} /></div>}{simulation.isError && <div className="grid min-h-[420px] place-items-center rounded-[1.35rem] border border-destructive/30 bg-card p-8 text-center"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-destructive/10 text-destructive"><AlertCircle size={21} /></span><p className="mt-4 text-sm font-semibold">Simulation could not run</p><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{simulation.error instanceof Error ? simulation.error.message : "The API returned an unexpected error. No demo result was substituted."}</p><Button className="mt-4" variant="soft" onClick={runSimulation}>Try again</Button></div>}{!simulation.isPending && !simulation.isError && !result && <div className="grid min-h-[420px] place-items-center rounded-[1.35rem] border border-dashed border-border bg-muted/35 p-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-card text-primary"><Clock3 size={22} /></span><p className="mt-4 text-sm font-semibold">Run a scenario to see the impact</p><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Choose a station and intervention. The simulator will compare waiting time and estimated revenue before and after the decision.</p></div></div>}{result && !simulation.isPending && <div className="space-y-5">{resultIsStale && <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"><AlertCircle size={14} />This result used an earlier time context. Run it again for {timeLabel}.</div>}<SimulationSummary result={result} stationName={selectedStation?.name ?? form.stationId} /><ImpactKpiCards result={result} /><Link to="/results" className="inline-flex items-center rounded-full bg-muted px-4 py-2.5 text-xs font-semibold hover:opacity-80">Review Results &amp; Impact</Link></div>}</div></section>{result && !simulation.isPending && <section className="grid gap-5 lg:grid-cols-2"><ComparisonChart title="Predicted waiting time" description={`${scenarioLabel} · lower is better`} before={result.before_wait_min} after={result.after_wait_min} unit="min" formatter={(value) => String(value)} /><ComparisonChart title="Estimated charging revenue" description="Aggregate scenario estimate · RM" before={result.before_revenue_rm} after={result.after_revenue_rm} unit="RM" formatter={(value) => String(value)} /></section>}</div>
}
