import type { ChargingStation, StationFilter } from "@/features/map/types"
import { StationCard } from "@/features/map/components/StationCard"
import { StationFilterAccordion } from "@/features/map/components/StationFilterAccordion"

export function StationList({ stations, selectedId, onSelect, filter, onFilterChange }: { stations: readonly ChargingStation[]; selectedId: string | null; onSelect: (id: string) => void; filter: StationFilter; onFilterChange: (filter: StationFilter) => void }) {
  return <section className="flex min-h-0 flex-col"><StationFilterAccordion stationCount={stations.length} filter={filter} onFilterChange={onFilterChange} /><div className="mt-3 space-y-2 overflow-y-auto pb-1 lg:max-h-[calc(min(76vh,780px)-8.5rem)]">{stations.length ? stations.map((station) => <StationCard key={station.id} station={station} selected={station.id === selectedId} onSelect={() => onSelect(station.id)} />) : <div className="rounded-2xl border border-dashed border-border p-8 text-center"><p className="text-sm font-semibold">No stations match</p><p className="mt-1 text-xs text-muted-foreground">Try another search or status filter.</p></div>}</div></section>
}
