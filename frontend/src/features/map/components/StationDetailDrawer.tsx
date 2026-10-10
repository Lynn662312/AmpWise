import { useEffect, useRef, type ReactNode } from "react"
import { BatteryCharging, MapPin, Power, X, Zap } from "lucide-react"
import type { ChargingStation } from "@/features/map/types"
import { formatWaitMinutes, formatWaitValue, getLevelLabel, isValidWait } from "@/features/map/utils/mapHelpers"
import { cn } from "@/lib/utils"
import { useStationForecast } from "@/features/stations/hooks/useStationForecast"
import { useSimulatedTime } from "@/context/TimeContext"
import { formatForecastDate, formatForecastSlotTime } from "@/lib/formatters"

export function StationDetailDrawer({ station, open, onOpenChange }: { station: ChargingStation | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const { selectedIsoTime } = useSimulatedTime()
  const forecastQuery = useStationForecast(station?.id ?? "", selectedIsoTime, 2)

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus())
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("keydown", handleKeyDown) }
  }, [onOpenChange, open])

  if (!station || !open) return null
  const statusClass = { low: "bg-success/15 text-success", moderate: "bg-warning/15 text-warning", high: "bg-destructive/15 text-destructive", unavailable: "bg-muted text-muted-foreground" }[station.level]
  const forecast = forecastQuery.data ?? station.forecast
  const availableForecast = forecast.filter(({ predicted_wait_min }) => isValidWait(predicted_wait_min))

  return <section role="dialog" aria-modal="false" aria-labelledby="station-detail-title" className="pointer-events-auto absolute inset-x-3 bottom-3 z-[650] max-h-[70%] overflow-y-auto rounded-[2rem] bg-primary p-5 text-primary-foreground shadow-2xl outline-none animate-in fade-in slide-in-from-bottom-2 sm:inset-x-auto sm:right-5 sm:top-5 sm:bottom-auto sm:w-[min(390px,calc(100%-2.5rem))] sm:max-h-[calc(100%-2.5rem)] sm:p-6">
    <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-primary-foreground/25 sm:hidden" />
    <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/60">Selected station</p><h2 id="station-detail-title" className="mt-2 break-words font-display text-3xl font-semibold leading-[0.95] sm:text-4xl">{station.name}</h2>{station.location && <p className="mt-3 flex items-start gap-1.5 text-sm text-primary-foreground/70"><MapPin className="mt-0.5 shrink-0" size={15} />{station.location}</p>}</div><button ref={closeRef} type="button" onClick={() => onOpenChange(false)} className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-foreground/15 text-primary-foreground transition hover:bg-primary-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Close station details"><X size={19} /></button></div>
    <div className="mt-6 rounded-[1.5rem] bg-primary-foreground/10 p-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-semibold">Availability</p><p className="mt-2 text-lg font-semibold">{station.n_working === null || station.n_chargers === null ? "Data unavailable" : `${station.n_working} / ${station.n_chargers} chargers working`}</p><p className="mt-1 text-xs text-primary-foreground/65">{formatWaitMinutes(station.predicted_wait_min)}</p><div className="mt-4 flex flex-wrap items-center gap-2"><span className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", statusClass)}>{getLevelLabel(station.level)}</span><span className="text-xs font-medium text-primary-foreground/70">{station.power_kw === null ? "Data unavailable" : `${station.power_kw} kW total`}</span></div></div><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground"><Zap size={28} fill="currentColor" /></span></div><div className="mt-5 grid grid-cols-2 gap-3 border-t border-primary-foreground/10 pt-4"><DetailStat icon={<BatteryCharging />} label="Working" value={station.n_working === null || station.n_chargers === null ? "Data unavailable" : `${station.n_working}/${station.n_chargers}`} /><DetailStat icon={<Power />} label="Power" value={station.power_kw === null ? "Data unavailable" : `${station.power_kw} kW`} /></div></div>
    <div className="mt-5"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Forecast preview</h3>{forecast.length > 0 && <p className="mt-1 text-[11px] text-primary-foreground/55">{formatForecastDate(forecast[0].time)}</p>}</div><span className="text-[11px] text-primary-foreground/55">next 2 hours</span></div>{forecastQuery.isLoading ? <p className="mt-3 rounded-2xl bg-primary-foreground/10 px-3 py-3 text-xs text-primary-foreground/65">Loading forecast…</p> : availableForecast.length ? <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{availableForecast.map((item) => <div key={item.time} className="min-w-20 rounded-2xl bg-primary-foreground/10 p-3 text-center"><p className="whitespace-nowrap text-[11px] text-primary-foreground/70">{formatForecastSlotTime(item.time, forecast[0]?.time)}</p><p className="mt-1 font-display text-2xl font-semibold">{formatWaitValue(item.predicted_wait_min)}</p><p className="text-[10px] text-primary-foreground/55">min wait</p></div>)}</div> : <p className="mt-3 rounded-2xl bg-primary-foreground/10 px-3 py-3 text-xs text-primary-foreground/65">Forecast currently unavailable.</p>}</div>
  </section>
}

function DetailStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div><span className="text-accent [&>svg]:h-4 [&>svg]:w-4">{icon}</span><p className="mt-2 text-[11px] text-primary-foreground/55">{label}</p><p className="mt-0.5 text-sm font-semibold">{value}</p></div>
}
