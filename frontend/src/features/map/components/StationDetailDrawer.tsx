import * as Dialog from "@radix-ui/react-dialog"
import { ArrowUpRight, BatteryCharging, CheckCircle2, Clock3, MapPin, Power, X } from "lucide-react"
import { Link } from "react-router-dom"
import type { ChargingStation } from "@/features/map/types"
import { getLevelLabel } from "@/features/map/utils/mapHelpers"
import { cn } from "@/lib/utils"

export function StationDetailDrawer({ station, open, onOpenChange }: { station: ChargingStation | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!station) return null
  const statusClass = { low: "bg-success/15 text-success", moderate: "bg-warning/15 text-warning", high: "bg-destructive/15 text-destructive", unavailable: "bg-muted text-muted-foreground" }[station.level]

  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-40 bg-primary/10 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out sm:bg-transparent sm:backdrop-blur-none" />
    <Dialog.Content className="fixed inset-x-3 bottom-3 z-50 max-h-[82vh] overflow-y-auto rounded-[2rem] bg-primary p-5 text-primary-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out sm:inset-x-auto sm:right-6 sm:top-28 sm:bottom-6 sm:w-[min(390px,calc(100vw-3rem))] sm:rounded-[2rem] sm:p-6">
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-primary-foreground/25 sm:hidden" />
      <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/60">Selected station</p><Dialog.Title className="mt-2 font-display text-4xl font-semibold leading-none">{station.name}</Dialog.Title><Dialog.Description className="mt-3 flex items-start gap-1.5 text-sm text-primary-foreground/70"><MapPin className="mt-0.5 shrink-0" size={15} />{station.location}</Dialog.Description></div><Dialog.Close className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-foreground/15 text-primary-foreground transition hover:bg-primary-foreground/25" aria-label="Close station details"><X size={19} /></Dialog.Close></div>
      <div className="mt-6 rounded-[1.5rem] bg-primary-foreground/10 p-4"><div className="flex items-center justify-between gap-3"><span className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", statusClass)}>{getLevelLabel(station.level)}</span><span className="text-right text-xs font-medium text-primary-foreground/75">{station.predicted_wait_min === null ? "Wait unavailable" : `${station.predicted_wait_min} min predicted wait`}</span></div><div className="mt-5 grid grid-cols-2 gap-4"><DetailStat icon={<BatteryCharging />} label="Working chargers" value={`${station.n_working} / ${station.n_chargers}`} /><DetailStat icon={<Power />} label="Charging power" value={`${station.power_kw} kW`} /><DetailStat icon={<Clock3 />} label="Forecast horizon" value="Next 2 hours" /><DetailStat icon={<CheckCircle2 />} label="Data mode" value="Mock forecast" /></div></div>
      <div className="mt-5"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Forecast preview</h3><span className="text-[11px] text-primary-foreground/55">predicted wait</span></div><div className="mt-3 grid grid-cols-3 gap-2">{station.forecast.map((forecast) => <div key={forecast.time} className="rounded-2xl bg-primary-foreground/10 p-3 text-center"><p className="text-[11px] text-primary-foreground/55">{forecast.time}</p><p className="mt-1 font-display text-2xl font-semibold">{forecast.predicted_wait_min === null ? "—" : forecast.predicted_wait_min}</p><p className="text-[10px] text-primary-foreground/55">min</p></div>)}</div></div>
      <div className="mt-6 grid gap-2"><Link to={`/stations/${station.id}`} className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-95">View station details <ArrowUpRight size={16} /></Link><Link to={`/stations/${station.id}#forecast`} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary-foreground/20">View forecast <Clock3 size={16} /></Link></div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>
}

function DetailStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div><span className="text-accent [&>svg]:h-4 [&>svg]:w-4">{icon}</span><p className="mt-2 text-[11px] text-primary-foreground/55">{label}</p><p className="mt-0.5 text-sm font-semibold">{value}</p></div>
}
