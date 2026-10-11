import { ArrowLeft, BatteryCharging, Clock3, MapPin, Power, RefreshCw, Zap } from "lucide-react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { useMemo, type ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { AnimatedNumber } from "@/components/common/AnimatedNumber"
import { useSimulatedTime } from "@/context/TimeContext"
import { useStationChargers } from "@/features/stations/hooks/useStationChargers"
import { StationActions } from "@/features/stations/components/StationActions"
import { useMapStations } from "@/features/map/hooks/useMapStations"
import { useStationForecast } from "@/features/stations/hooks/useStationForecast"
import { getLevelLabel } from "@/features/map/utils/mapHelpers"
import { formatForecastDate, formatForecastSlotTime } from "@/lib/formatters"
import { cn } from "@/lib/utils"

export function StationDetailPage() {
  const { id = "" } = useParams()
  const [searchParams] = useSearchParams()
  const { selectedIsoTime } = useSimulatedTime()
  const { data, isLoading, isError } = useMapStations()
  const station = data?.stations.find((item) => item.id === id) ?? null
  const forecast = useStationForecast(station?.id ?? "", selectedIsoTime, 2)
  const chargers = useStationChargers(station).data
  const selectedCharger = useMemo(() => chargers?.find(({ id: chargerId }) => chargerId === searchParams.get("charger")) ?? null, [chargers, searchParams])

  if (isLoading) return <DetailState title="Loading station details…" />
  if (isError || !station) return <NotFoundState title="Station not found" description="This station ID is not available in the current dataset." />
  const statusClass = { low: "bg-success/15 text-success", moderate: "bg-warning/15 text-warning", high: "bg-destructive/15 text-destructive", unavailable: "bg-muted text-muted-foreground" }[station.level]

  return <div className="space-y-6 pb-6">
    <Link to="/map" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Back to map</Link>
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"><MapPin size={13} className="text-primary" /> Station profile</p><h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-none tracking-tight sm:text-[2.25rem] lg:text-[2.5rem]">{station.name}</h1>{station.location && <p className="mt-2 text-sm text-muted-foreground">{station.location}</p>}</div><span className={cn("w-fit rounded-full px-3 py-2 text-xs font-semibold", statusClass)}>{getLevelLabel(station.level)}</span></section>
    <div className="grid gap-4 sm:grid-cols-3"><Stat icon={<BatteryCharging />} label="Working chargers" value={station.n_working} suffix={station.n_chargers === null ? undefined : `/${station.n_chargers}`} /><Stat icon={<Power />} label="Charging power" value={station.power_kw} suffix=" kW" /><Stat icon={<Clock3 />} label="Predicted wait" value={station.predicted_wait_min} suffix=" min" /></div>
    <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]"><Card className="min-w-0 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-3xl font-semibold">Forecast</h2><p className="mt-1 text-xs text-muted-foreground">30-minute queue slots from the current simulation time.</p></div><Zap className="text-primary" size={22} /></div>{forecast.isLoading ? <div className="mt-6 h-24 animate-pulse rounded-2xl bg-muted" /> : forecast.isError ? <p className="mt-6 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Forecast currently unavailable.</p> : <div className="mt-6"><p className="text-xs font-semibold text-muted-foreground">{forecast.data?.length ? formatForecastDate(forecast.data[0].time) : "Time unavailable"}</p><div className="mt-3 flex gap-3 overflow-x-auto pb-1">{(forecast.data ?? []).map((item) => <div key={item.time} className="min-w-32 rounded-2xl bg-muted p-4"><div className="flex items-center justify-between gap-2"><p className="whitespace-nowrap text-xs text-muted-foreground">{formatForecastSlotTime(item.time, forecast.data?.[0]?.time)}</p>{item.is_festive && <span className="text-[10px] font-semibold text-warning">Festive</span>}</div><p className="mt-1 font-display text-3xl font-semibold">{item.predicted_wait_min == null ? "—" : <AnimatedNumber value={item.predicted_wait_min} />}</p><p className="text-[11px] text-muted-foreground">min wait</p><p className="mt-2 text-[11px] text-muted-foreground">Arrivals {item.arrivals ?? "—"} · Baseline {item.arrivals_baseline ?? "—"}</p></div>)}</div></div>}</Card><Card className="min-w-0 p-5 sm:p-6"><h2 className="font-display text-3xl font-semibold">Operations</h2><p className="mt-1 text-xs text-muted-foreground">Review chargers or test an intervention.</p><div className="mt-5 space-y-2">{Boolean(chargers?.length) && <div className="max-h-64 space-y-2 overflow-y-auto">{(chargers ?? []).map((charger) => <Link key={charger.id} to={`/chargers/${charger.id}?station=${station.id}`} className={cn("flex items-center justify-between rounded-2xl bg-muted p-3 text-sm font-semibold hover:bg-brand-soft", selectedCharger?.id === charger.id && "ring-2 ring-primary/30")}><span>{charger.id}</span><span className="text-xs font-medium capitalize text-muted-foreground">{charger.status.replace("_", " ")}</span></Link>)}</div>}<Link to={`/what-if?station=${station.id}${selectedCharger ? `&charger=${selectedCharger.id}` : ""}`} className="flex items-center justify-between rounded-2xl bg-primary p-3 text-sm font-semibold text-primary-foreground hover:brightness-110">Run what-if simulation<ArrowLeft className="rotate-180" size={15} /></Link></div></Card></section>
    <StationActions stationId={station.id} />
  </div>
}

function Stat({ icon, label, value, suffix }: { icon: ReactNode; label: string; value: number | null; suffix?: string }) { return <Card className="p-4"><span className="text-primary [&>svg]:size-5">{icon}</span><p className="mt-4 text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-3xl font-semibold">{value == null ? "Unavailable" : <AnimatedNumber value={value} suffix={suffix} />}</p></Card> }
function DetailState({ title }: { title: string }) { return <div className="grid min-h-72 place-items-center rounded-[1.5rem] bg-card text-sm text-muted-foreground"><div className="flex items-center gap-2"><RefreshCw className="animate-spin text-primary" size={17} />{title}</div></div> }
function NotFoundState({ title, description }: { title: string; description: string }) { return <div className="grid min-h-72 place-items-center rounded-[1.5rem] bg-card p-8 text-center"><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p><Link className="mt-4 inline-flex rounded-full bg-muted px-4 py-2.5 text-sm font-semibold hover:opacity-80" to="/map">Return to map</Link></div></div> }
