import { MapPin, Zap } from "lucide-react"
import type { ChargingStation } from "@/features/map/types"
import { getLevelLabel } from "@/features/map/utils/mapHelpers"
import { cn } from "@/lib/utils"

export function StationCard({ station, selected, onSelect }: { station: ChargingStation; selected: boolean; onSelect: () => void }) {
  const statusClass = { low: "bg-success", moderate: "bg-warning", high: "bg-destructive", unavailable: "bg-muted-foreground" }[station.level]
  const statusTextClass = { low: "text-success", moderate: "text-warning", high: "text-destructive", unavailable: "text-muted-foreground" }[station.level]
  return <button type="button" aria-pressed={selected} onClick={onSelect} className={cn("group w-full rounded-[1.35rem] bg-background p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected && "bg-brand-soft ring-2 ring-primary/20")}>
    <div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-primary transition group-hover:bg-primary group-hover:text-primary-foreground"><Zap size={17} fill="currentColor" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{station.name}</span><span className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="shrink-0" size={12} />{station.location}</span></span><span className={cn("size-2 shrink-0 rounded-full", statusClass)} aria-label={getLevelLabel(station.level)} /></div>
    <div className="mt-3 flex items-center justify-between gap-2 pl-[52px]"><span className={cn("text-xs font-semibold", statusTextClass)}>{station.predicted_wait_min === null ? "No wait data" : `${station.predicted_wait_min} min predicted wait`}</span><span className="text-[11px] font-medium text-muted-foreground">{station.n_working}/{station.n_chargers} working</span></div>
  </button>
}
