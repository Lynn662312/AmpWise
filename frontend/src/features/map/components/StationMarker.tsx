import { useMemo } from "react"
import { Marker } from "react-leaflet"
import L from "leaflet"
import type { ChargingStation } from "@/features/map/types"
import { getLevelClass } from "@/features/map/utils/mapHelpers"

function markerHtml(level: ChargingStation["level"], selected: boolean) {
  const selectedClass = selected ? "station-marker--selected" : ""
  return `<span class="station-marker ${getLevelClass(level)} ${selectedClass}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor"/></svg></span>`
}

export function StationMarker({ station, selected, onSelect }: { station: ChargingStation; selected: boolean; onSelect: () => void }) {
  const icon = useMemo(() => L.divIcon({ className: "station-marker-icon", html: markerHtml(station.level, selected), iconSize: selected ? [46, 46] : [38, 38], iconAnchor: selected ? [23, 23] : [19, 19], popupAnchor: [0, -22] }), [selected, station.level])
  return <Marker position={[station.lat, station.lon]} icon={icon} eventHandlers={{ click: onSelect }} />
}
