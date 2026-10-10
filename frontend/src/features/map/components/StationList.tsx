import { ListFilter } from "lucide-react"
import type { ChargingStation } from "@/features/map/types"
import { StationCard } from "@/features/map/components/StationCard"

export function StationList({ stations, selectedId, onSelect }: { stations: readonly ChargingStation[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <section className="flex min-h-0 flex-col"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-2xl font-semibold">Stations</h2><p className="mt-0.5 text-xs text-muted-foreground">{stations.length} locations in view</p></div><span className="grid size-9 place-items-center rounded-full bg-brand-soft text-primary"><ListFilter size={16} /></span></div><div className="space-y-2 overflow-y-auto pb-1 lg:max-h-[calc(min(76vh,780px)-8.5rem)]">{stations.length ? stations.map((station) => <StationCard key={station.id} station={station} selected={station.id === selectedId} onSelect={() => onSelect(station.id)} />) : <div className="rounded-2xl border border-dashed border-border p-8 text-center"><p className="text-sm font-semibold">No stations match</p><p className="mt-1 text-xs text-muted-foreground">Try another search or status filter.</p></div>}</div></section>
}
