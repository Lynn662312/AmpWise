import { useEffect } from "react"
import { MapContainer, TileLayer, useMap } from "react-leaflet"
import type { LatLngTuple } from "leaflet"
import "leaflet/dist/leaflet.css"
import type { ChargingStation } from "@/features/map/types"
import { corridorCenter, corridorZoom, getStationBounds } from "@/features/map/utils/mapHelpers"
import { StationMarker } from "@/features/map/components/StationMarker"
import { MapControls } from "@/features/map/components/MapControls"

function MapController({ stations, selectedStation }: { stations: readonly ChargingStation[]; selectedStation: ChargingStation | null }) {
  const map = useMap()
  useEffect(() => {
    const bounds = getStationBounds(stations)
    if (bounds) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 })
    else map.setView(corridorCenter, corridorZoom)
  }, [map, stations])
  useEffect(() => {
    if (selectedStation) map.flyTo([selectedStation.lat, selectedStation.lon], Math.max(map.getZoom(), 13), { duration: 0.35 })
  }, [map, selectedStation])
  useEffect(() => {
    const invalidate = () => map.invalidateSize({ pan: false })
    const timeout = window.setTimeout(invalidate, 100)
    const observer = new ResizeObserver(invalidate)
    observer.observe(map.getContainer())
    return () => { window.clearTimeout(timeout); observer.disconnect() }
  }, [map])
  return null
}

export function MapView({ stations, selectedId, onSelect }: { stations: readonly ChargingStation[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const selectedStation = stations.find(({ id }) => id === selectedId) ?? null
  return <div className="relative h-[min(66vh,650px)] min-h-[430px] overflow-hidden rounded-[2rem] bg-muted shadow-[0_20px_55px_color-mix(in_srgb,var(--primary)_8%,transparent)]">
    <MapContainer center={corridorCenter as LatLngTuple} zoom={corridorZoom} scrollWheelZoom className="size-full" aria-label="AmpWise charging station map">
      <TileLayer attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapController stations={stations} selectedStation={selectedStation} />
      <MapControls stations={stations} />
      {stations.map((station) => <StationMarker key={station.id} station={station} selected={station.id === selectedId} onSelect={() => onSelect(station.id)} />)}
    </MapContainer>
    <div className="pointer-events-none absolute bottom-4 left-4 z-[400] rounded-xl bg-card/90 px-3 py-2 text-[11px] font-medium text-muted-foreground shadow-lg backdrop-blur">Demo forecast · KL–JB corridor</div>
  </div>
}
