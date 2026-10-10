import type { ChargingStation } from "@/features/map/types"
import { AppSelect } from "@/components/common/AppSelect"

export function StationSelector({ stations, value, onChange }: { stations: readonly ChargingStation[]; value: string; onChange: (value: string) => void }) {
  return <AppSelect label="Charging station" value={value} onValueChange={onChange} placeholder="Select a station" searchable={stations.length > 6} options={stations.map((station) => ({ value: station.id, label: station.name, description: station.location ?? undefined }))} />
}
