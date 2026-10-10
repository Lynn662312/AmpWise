import { useMemo, useState } from "react"
import { List, MapPin, RefreshCw, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSimulatedTime } from "@/context/TimeContext"
import { MapFilters } from "@/features/map/components/MapFilters"
import { MapView } from "@/features/map/components/MapView"
import { StationDetailDrawer } from "@/features/map/components/StationDetailDrawer"
import { StationList } from "@/features/map/components/StationList"
import { useMapStations } from "@/features/map/hooks/useMapStations"
import type { StationFilter } from "@/features/map/types"
import { filterStations } from "@/features/map/utils/mapHelpers"
import { cn } from "@/lib/utils"

export function MapPage() {
  const { timeLabel } = useSimulatedTime()
  const { data, isError, refetch, isFetching } = useMapStations()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<StationFilter>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showStationRail, setShowStationRail] = useState(false)
  const stations = data?.stations ?? []
  const filteredStations = useMemo(() => filterStations(stations, query, filter), [filter, query, stations])
  const selectedStation = stations.find(({ id }) => id === selectedId) ?? null
  const workingChargers = stations.reduce((sum, station) => sum + station.n_working, 0)
  const highCongestion = stations.filter(({ level }) => level === "high").length

  return <div className="space-y-4 pb-4">
    <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"><MapPin size={13} className="text-primary" /> Malaysia operations</div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Charging network <span className="text-primary">overview.</span></h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Demand, availability and predicted congestion in one operational view.</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground sm:inline-flex">{timeLabel} · {data?.source === "mock" ? "Demo forecast" : "Live feed"}</span>
        <Button variant="soft" onClick={() => void refetch()} disabled={isFetching} aria-label="Refresh station data"><RefreshCw className={cn(isFetching && "animate-spin")} size={15} /><span className="hidden sm:inline">Refresh</span></Button>
      </div>
    </section>

    <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold text-muted-foreground scrollbar-none">
      <span className="shrink-0 rounded-full bg-card px-3 py-2 shadow-sm"><span className="mr-1.5 inline-block size-2 rounded-full bg-success" />{stations.length} stations</span>
      <span className="shrink-0 rounded-full bg-card px-3 py-2 shadow-sm"><span className="mr-1.5 inline-block size-2 rounded-full bg-primary" />{workingChargers} working chargers</span>
      <span className="shrink-0 rounded-full bg-card px-3 py-2 shadow-sm"><span className="mr-1.5 inline-block size-2 rounded-full bg-warning" />{highCongestion} high congestion</span>
      <span className="ml-auto hidden shrink-0 text-muted-foreground sm:inline">Predictions are simulated, not live availability.</span>
    </div>

    <section className="relative grid min-h-[min(76vh,780px)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,21rem)]">
      <div className="relative min-h-[min(66vh,650px)] min-w-0">
        <div className="absolute left-4 top-4 z-[500] flex max-w-[calc(100%-6rem)] items-center gap-2 sm:left-5 sm:top-5">
          <label className="flex min-w-0 items-center gap-2 rounded-full bg-card/95 px-4 py-3 text-sm shadow-xl backdrop-blur focus-within:ring-2 focus-within:ring-ring"><Search size={16} className="shrink-0 text-primary" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 bg-transparent outline-none placeholder:text-muted-foreground sm:w-44" placeholder="Search stations" aria-label="Search stations" />{query && <button type="button" onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground" aria-label="Clear search"><X size={15} /></button>}</label>
          <button type="button" onClick={() => setShowStationRail((open) => !open)} className="grid size-11 shrink-0 place-items-center rounded-full bg-card/95 text-primary shadow-xl backdrop-blur hover:bg-primary hover:text-primary-foreground lg:hidden" aria-label="Toggle station list" aria-pressed={showStationRail}><List size={18} /></button>
        </div>
        <div className="absolute bottom-4 left-4 z-[500] hidden max-w-[calc(100%-2rem)] items-center gap-2 rounded-full bg-card/90 px-3 py-2 text-[11px] font-semibold text-muted-foreground shadow-lg backdrop-blur sm:flex sm:left-5 sm:bottom-5"><span className="size-2 rounded-full bg-accent" />KL–JB corridor · {timeLabel}</div>
        {isError ? <div className="grid h-full min-h-[min(66vh,650px)] place-items-center rounded-[2rem] bg-card p-8 text-center shadow-[0_20px_55px_color-mix(in_srgb,var(--primary)_7%,transparent)]"><div><p className="text-sm font-semibold">Charging data is unavailable</p><p className="mt-1 text-xs text-muted-foreground">Try refreshing the station feed.</p><Button className="mt-4" onClick={() => void refetch()}>Try again</Button></div></div> : <MapView stations={filteredStations} selectedId={selectedId} onSelect={setSelectedId} />}
        <StationDetailDrawer station={selectedStation} open={Boolean(selectedStation)} onOpenChange={(open) => { if (!open) setSelectedId(null) }} />
      </div>

      <aside className={cn("absolute inset-x-0 top-16 z-[600] max-h-[calc(100%-4rem)] rounded-[1.75rem] bg-card p-4 shadow-2xl transition-transform lg:static lg:block lg:max-h-none lg:rounded-[1.75rem] lg:p-4 lg:shadow-[0_20px_55px_color-mix(in_srgb,var(--primary)_6%,transparent)]", showStationRail ? "translate-y-0" : "-translate-y-[120%] lg:translate-y-0")}>
        <div className="mb-3 flex items-center justify-between lg:hidden"><p className="font-display text-2xl font-semibold">Stations</p><button type="button" onClick={() => setShowStationRail(false)} className="grid size-10 place-items-center rounded-full bg-muted" aria-label="Close station list"><X size={17} /></button></div>
        <MapFilters query={query} filter={filter} onQueryChange={setQuery} onFilterChange={setFilter} compact />
        <div className="mt-4 border-t border-border/70 pt-4"><StationList stations={filteredStations} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setShowStationRail(false) }} /></div>
      </aside>
    </section>
    <p className="text-center text-xs text-muted-foreground sm:hidden">Swipe the station list up for more locations.</p>
  </div>
}
