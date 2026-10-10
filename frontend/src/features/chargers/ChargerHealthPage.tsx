import { ArrowLeft, BatteryCharging, CheckCircle2, Gauge, RefreshCw, TriangleAlert } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { useMemo, type ReactNode } from "react"
import { ResponsiveContainer, LineChart, Line, Tooltip, XAxis, YAxis } from "recharts"
import { Card } from "@/components/ui/card"
import { AnimatedNumber } from "@/components/common/AnimatedNumber"
import { useMapStations } from "@/features/map/hooks/useMapStations"
import { getMockChargers } from "@/services/mockService"
import { useChargerHealth } from "@/features/chargers/hooks/useChargerHealth"
import { cn } from "@/lib/utils"

export function ChargerHealthPage() {
  const { id = "" } = useParams()
  const { data: stationData, isLoading: stationsLoading, isError: stationsError } = useMapStations()
  const match = useMemo(() => stationData?.stations.map((station) => ({ station, charger: getMockChargers(station).find(({ id: chargerId }) => chargerId === id) })).find(({ charger }) => Boolean(charger)) ?? null, [id, stationData?.stations])
  const health = useChargerHealth(id, 7, match?.station ?? null)

  if (stationsLoading) return <State title="Loading charger health…" />
  if (stationsError || !match?.charger) return <NotFoundState />
  const { station, charger } = match
  const series = health.data?.series ?? []
  const latest = series.at(-1)
  const degraded = charger.status !== "working"

  return <div className="space-y-6 pb-6"><Link to={`/stations/${station.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Back to station</Link><section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Charger health</p><h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-none tracking-tight sm:text-[2.25rem] lg:text-[2.5rem]">{charger.id}</h1><p className="mt-2 text-sm text-muted-foreground">{station.name} · {station.location ?? "Location unavailable"}</p></div><span className={cn("inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold", degraded ? "bg-warning/15 text-warning" : "bg-success/15 text-success")}>{degraded ? <TriangleAlert size={14} /> : <CheckCircle2 size={14} />}{degraded ? charger.status : "Working"}</span></section><div className="grid gap-4 sm:grid-cols-3"><HealthStat icon={<BatteryCharging />} label="Rated power" value={charger.power_kw} suffix=" kW" /><HealthStat icon={<Gauge />} label="Actual power ratio" value={latest?.actual_power_ratio == null ? null : latest.actual_power_ratio * 100} suffix="%" /><HealthStat icon={<TriangleAlert />} label="Fault probability" value={latest?.fault_probability == null ? null : latest.fault_probability * 100} suffix="%" /></div><Card className="p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-3xl font-semibold">Power delivery evidence</h2><p className="mt-1 text-xs text-muted-foreground">Actual power ratio compared with the configured baseline.</p></div><Link to={`/what-if?station=${station.id}&charger=${charger.id}`} className="rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:brightness-110">Test repair</Link></div>{health.isLoading ? <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted" /> : health.isError ? <p className="mt-6 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Health history currently unavailable.</p> : <div className="mt-6 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={series}><XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} /><YAxis domain={[0, 1]} tickFormatter={(value) => `${Math.round(value * 100)}%`} axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} /><Tooltip formatter={(value: unknown) => typeof value !== "number" ? "Unavailable" : `${Math.round(value * 100)}%`} contentStyle={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 12 }} /><Line type="monotone" dataKey="actual_power_ratio" name="Actual power" stroke="var(--brand-green)" strokeWidth={3} dot={false} connectNulls={false} /><Line type="monotone" dataKey="baseline_power_ratio" name="Baseline" stroke="var(--muted-foreground)" strokeDasharray="5 5" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>}</Card></div>
}

function HealthStat({ icon, label, value, suffix }: { icon: ReactNode; label: string; value: number | null; suffix?: string }) { return <Card className="p-4"><span className="text-primary [&>svg]:size-5">{icon}</span><p className="mt-4 text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-3xl font-semibold">{value == null ? "Unavailable" : <AnimatedNumber value={value} decimals={suffix === "%" ? 0 : 1} suffix={suffix} />}</p></Card> }
function State({ title }: { title: string }) { return <div className="grid min-h-72 place-items-center rounded-[1.5rem] bg-card text-sm text-muted-foreground"><div className="flex items-center gap-2"><RefreshCw className="animate-spin text-primary" size={17} />{title}</div></div> }
function NotFoundState() { return <div className="grid min-h-72 place-items-center rounded-[1.5rem] bg-card p-8 text-center"><div><p className="text-sm font-semibold">Charger not found</p><p className="mt-1 text-xs text-muted-foreground">This charger ID is not available in the current dataset.</p><Link className="mt-4 inline-flex rounded-full bg-muted px-4 py-2.5 text-sm font-semibold hover:opacity-80" to="/map">Return to map</Link></div></div> }
