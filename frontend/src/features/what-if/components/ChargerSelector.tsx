import { useEffect } from "react"
import type { ChargingStation } from "@/features/map/types"
import { AppSelect } from "@/components/common/AppSelect"
import { useStationChargers } from "@/features/stations/hooks/useStationChargers"

// Repairing a charger that works changes nothing, so only the faulty ones are offered.
export function ChargerSelector({ station, value, onChange }: { station: ChargingStation | null; value: string; onChange: (value: string) => void }) {
  const { data: chargers = [], isLoading } = useStationChargers(station)
  const faulty = chargers.filter(({ status }) => status !== "healthy" && status !== "working")
  const valueIsOffered = faulty.some(({ id }) => id === value)
  useEffect(() => { if (value && !isLoading && !valueIsOffered) onChange("") }, [isLoading, onChange, value, valueIsOffered])
  return <AppSelect label="Faulty charger" description={!isLoading && station && !faulty.length ? "No charger at this station reports a fault at the selected time." : "Chargers whose sensors report a fault at the selected time"} value={value} onValueChange={onChange} disabled={!station || isLoading || !faulty.length} placeholder={isLoading ? "Loading chargers…" : faulty.length ? "Select a charger" : "No faulty charger"} options={faulty.map((charger) => ({ value: charger.id, label: charger.id, description: `${charger.status.replace("_", " ")} · ${charger.power_kw} kW` }))} />
}
