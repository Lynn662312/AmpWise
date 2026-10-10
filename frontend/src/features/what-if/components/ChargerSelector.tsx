import { getMockChargers } from "@/services/mockService"
import type { ChargingStation } from "@/features/map/types"
import { AppSelect } from "@/components/common/AppSelect"
import { isApiMode } from "@/services/api-client"

export function ChargerSelector({ station, value, onChange }: { station: ChargingStation | null; value: string; onChange: (value: string) => void }) {
  const chargers = isApiMode ? [] : getMockChargers(station)
  return <AppSelect label="Faulty charger" description="Available charger registry" value={value} onValueChange={onChange} disabled={!station} placeholder="Select a charger" options={chargers.map((charger) => ({ value: charger.id, label: charger.id, description: `${charger.status} · ${charger.power_kw} kW` }))} />
}
