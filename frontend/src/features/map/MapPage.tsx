import { useCallback, useEffect, useMemo, useState } from "react"
import { List, MapPin, RefreshCw, Search, X } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { AnimatedNumber } from "@/components/common/AnimatedNumber"
import { AppTextField } from "@/components/common/AppTextField"
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
  const [searchParams] = useSearchParams()
  const { data, isError, refetch, isFetching } = useMapStations()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<StationFilter>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showStationRail, setShowStationRail] = useState(false)
  const stations = data?.stations ?? []
  const filteredStations = useMemo(() => filterStations(stations, query, filter), [filter, query, stations])
  const selectedStation = stations.find(({ id }) => id === selectedId) ?? null
  const workingChargers = stations.reduce((sum, station) => sum + (station.n_working ?? 0), 0)
  const hasOperationalData = stations.some((station) => station.n_working !== null)
  const highCongestion = stations.filter(({ level }) => level === "high").length
  const waitStations = stations.filter(({ predicted_wait_min }) => predicted_wait_min !== null)
  const averageWait = waitStations.length ? Math.round(waitStations.reduce((sum, station) => sum + (station.predicted_wait_min ?? 0), 0) / waitStations.length) : 0
  const closeStation = useCallback((open: boolean) => { if (!open) setSelectedId(null) }, [])
  const handleFilterChange = useCallback((next: StationFilter) => {
    setFilter(next)
    setSelectedId((current) => {
      const station = stations.find(({ id }) => id === current)
      return station && next !== "all" && station.level !== next ? null : current
    })
  }, [stations])

  useEffect(() => {
    const requestedStation = searchParams.get("station")
    if (requestedStation && stations.some(({ id }) => id === requestedStation)) setSelectedId(requestedStation)
  }, [searchParams, stations])

  return <div className="space-y-4 pb-4">
    <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"><MapPin size={13} className="text-primary" /> California operations</div>
        <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-none tracking-tight sm:text-[2.25rem] lg:text-[2.5rem]">Charging network <span className="text-primary">overview</span></h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Demand, availability and predicted congestion in one operational view.</p>
      </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="hidden rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground sm:inline-flex">{timeLabel}</span>
        <Button variant="soft" onClick={() => void refetch()} disabled={isFetching} aria-label="Refresh station data"><RefreshCw className={cn(isFetching && "animate-spin")} size={15} /><span className="hidden sm:inline">Refresh</span></Button>
      </div>
    </section>

    <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold text-muted-foreground scrollbar-none">
      <span className="shrink-0 rounded-full bg-card px-3 py-2 shadow-sm"><span className="mr-1.5 inline-block size-2 rounded-full bg-success" /><AnimatedNumber value={stations.length} /> stations</span>
      <span className="shrink-0 rounded-full bg-card px-3 py-2 shadow-sm"><span className="mr-1.5 inline-block size-2 rounded-full bg-primary" />{hasOperationalData ? <AnimatedNumber value={workingChargers} /> : "Data unavailable"} working chargers</span>
      <span className="shrink-0 rounded-full bg-card px-3 py-2 shadow-sm"><span className="mr-1.5 inline-block size-2 rounded-full bg-warning" />{hasOperationalData ? <AnimatedNumber value={highCongestion} /> : "Data unavailable"} high congestion</span>
      <span className="shrink-0 rounded-full bg-card px-3 py-2 shadow-sm"><span className="mr-1.5 inline-block size-2 rounded-full bg-info" />{waitStations.length ? <AnimatedNumber value={averageWait} suffix=" min" /> : "Data unavailable"} average wait</span>
    </div>

    <section className="relative grid min-h-[min(76vh,780px)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,21rem)]">
      <div className="relative min-h-[min(66vh,650px)] min-w-0">
        <div className="absolute left-4 top-4 z-[500] flex max-w-[calc(100%-6rem)] items-center gap-2 sm:left-5 sm:top-5">
          <AppTextField value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stations" aria-label="Search stations" startIcon={<Search size={16} className="text-primary" />} endIcon={query ? <button type="button" onClick={() => setQuery("")} className="pointer-events-auto text-muted-foreground hover:text-foreground" aria-label="Clear search"><X size={15} /></button> : undefined} size="default" className="min-w-0 rounded-full bg-card/95 px-4 py-1.5 text-sm shadow-xl backdrop-blur sm:w-60" />
          <button type="button" onClick={() => setShowStationRail((open) => !open)} className="grid size-11 shrink-0 place-items-center rounded-full bg-card/95 text-primary shadow-xl backdrop-blur hover:bg-primary hover:text-primary-foreground lg:hidden" aria-label="Toggle station list" aria-pressed={showStationRail}><List size={18} /></button>
        </div>
        <div className="absolute bottom-4 left-4 z-[500] hidden max-w-[calc(100%-2rem)] items-center gap-2 rounded-full bg-card/90 px-3 py-2 text-[11px] font-semibold text-muted-foreground shadow-lg backdrop-blur sm:flex sm:left-5 sm:bottom-5"><span className="size-2 rounded-full bg-accent" />California corridor · {timeLabel}</div>
        {isError ? <div className="grid h-full min-h-[min(66vh,650px)] place-items-center rounded-[2rem] bg-card p-8 text-center shadow-[0_20px_55px_color-mix(in_srgb,var(--primary)_7%,transparent)]"><div><p className="text-sm font-semibold">Charging data is unavailable</p><p className="mt-1 text-xs text-muted-foreground">Try refreshing the station feed.</p><Button className="mt-4" onClick={() => void refetch()}>Try again</Button></div></div> : <MapView stations={filteredStations} selectedId={selectedId} onSelect={setSelectedId} />}
        <StationDetailDrawer station={selectedStation} open={Boolean(selectedStation)} onOpenChange={closeStation} />
      </div>

      <aside className={cn("absolute inset-x-0 top-16 z-[600] max-h-[calc(100%-4rem)] rounded-[1.75rem] bg-card p-4 shadow-2xl transition-transform lg:static lg:block lg:max-h-none lg:rounded-[1.75rem] lg:p-4 lg:shadow-[0_20px_55px_color-mix(in_srgb,var(--primary)_6%,transparent)]", showStationRail ? "translate-y-0" : "-translate-y-[120%] lg:translate-y-0")}>
        <div className="mb-3 flex items-center justify-between lg:hidden"><p className="font-display text-2xl font-semibold">Stations</p><button type="button" onClick={() => setShowStationRail(false)} className="grid size-10 place-items-center rounded-full bg-muted" aria-label="Close station list"><X size={17} /></button></div>
        <MapFilters query={query} onQueryChange={setQuery} compact />
        <div className="mt-4 border-t border-border/70 pt-4"><StationList stations={filteredStations} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setShowStationRail(false) }} filter={filter} onFilterChange={handleFilterChange} /></div>
      </aside>
    </section>
    <p className="text-center text-xs text-muted-foreground sm:hidden">Swipe the station list up for more locations.</p>
  </div>
}
