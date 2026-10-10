import type { ChargingStation } from "@/features/map/types"
import { AppSelect } from "@/components/common/AppSelect"
import { useStationChargers } from "@/features/stations/hooks/useStationChargers"

export function ChargerSelector({ station, value, onChange }: { station: ChargingStation | null; value: string; onChange: (value: string) => void }) {
  const { data: chargers = [], isLoading } = useStationChargers(station)
  return <AppSelect label="Faulty charger" description="Chargers with sensor data at this station" value={value} onValueChange={onChange} disabled={!station || isLoading} placeholder={isLoading ? "Loading chargers…" : "Select a charger"} options={chargers.map((charger) => ({ value: charger.id, label: charger.id, description: `${charger.status.replace("_", " ")} · ${charger.power_kw} kW` }))} />
}
