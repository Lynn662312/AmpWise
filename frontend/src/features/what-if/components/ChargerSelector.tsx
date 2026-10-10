import { getMockChargers } from "@/mocks/chargers"
import type { ChargingStation } from "@/features/map/types"
import { AppSelect } from "@/components/common/AppSelect"

export function ChargerSelector({ station, value, onChange }: { station: ChargingStation | null; value: string; onChange: (value: string) => void }) {
  const chargers = getMockChargers(station)
  return <AppSelect label="Faulty charger" description="Demo registry" value={value} onValueChange={onChange} disabled={!station} placeholder="Select a charger" options={chargers.map((charger) => ({ value: charger.id, label: charger.id, description: `${charger.status} · ${charger.power_kw} kW` }))} />
}
