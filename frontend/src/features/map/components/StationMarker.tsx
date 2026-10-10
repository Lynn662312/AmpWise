import { useMemo } from "react"
import { Marker } from "react-leaflet"
import { renderToStaticMarkup } from "react-dom/server"
import L from "leaflet"
import type { ChargingStation } from "@/features/map/types"
import { getLevelClass } from "@/features/map/utils/mapHelpers"
import { EvChargerIcon } from "@/components/icons/EvChargerIcon"

const CHARGER_ICON_HTML = renderToStaticMarkup(<EvChargerIcon />)

function markerHtml(level: ChargingStation["level"], selected: boolean) {
  const selectedClass = selected ? "station-marker--selected" : ""
  return `<span class="station-marker ${getLevelClass(level)} ${selectedClass}">${CHARGER_ICON_HTML}</span>`
}

export function StationMarker({ station, selected, onSelect }: { station: ChargingStation; selected: boolean; onSelect: () => void }) {
  const icon = useMemo(() => L.divIcon({ className: "station-marker-icon", html: markerHtml(station.level, selected), iconSize: selected ? [46, 46] : [38, 38], iconAnchor: selected ? [23, 23] : [19, 19], popupAnchor: [0, -22] }), [selected, station.level])
  return <Marker position={[station.lat, station.lon]} icon={icon} eventHandlers={{ click: onSelect }} />
}
