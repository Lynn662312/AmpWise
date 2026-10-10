import { LocateFixed, Minus, Plus, Scan, Search } from "lucide-react"
import { useMap } from "react-leaflet"
import { corridorCenter, getStationBounds } from "@/features/map/utils/mapHelpers"
import type { ChargingStation } from "@/features/map/types"

export function MapControls({ stations }: { stations: readonly ChargingStation[] }) {
  const map = useMap()
  const fitStations = () => {
    const bounds = getStationBounds(stations)
    if (bounds) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 })
  }
  const controlClass = "grid h-10 w-10 place-items-center rounded-xl bg-card/95 text-foreground shadow-lg backdrop-blur transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return <div className="absolute right-4 top-4 z-[400] flex flex-col gap-2 sm:bottom-5 sm:left-5 sm:right-auto sm:top-auto">
    <button className={controlClass} onClick={() => map.zoomIn()} aria-label="Zoom in"><Plus size={18} /></button>
    <button className={controlClass} onClick={() => map.zoomOut()} aria-label="Zoom out"><Minus size={18} /></button>
    <span className="my-0.5 h-px bg-border" />
    <button className={controlClass} onClick={fitStations} aria-label="Fit all stations"><Scan size={17} /></button>
    <button className={controlClass} onClick={() => map.locate({ setView: true, maxZoom: 13 })} aria-label="Search my location" title="Search my location"><Search size={17} /></button>
    <button className={controlClass} onClick={() => map.setView(corridorCenter, 8)} aria-label="Recenter map"><LocateFixed size={17} /></button>
  </div>
}
