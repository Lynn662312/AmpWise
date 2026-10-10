import { getMockChargers } from "@/mocks/chargers"
import type { ChargingStation } from "@/features/map/types"

export function ChargerSelector({ station, value, onChange }: { station: ChargingStation | null; value: string; onChange: (value: string) => void }) {
  const chargers = getMockChargers(station)
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Faulty charger <span className="font-normal">(demo registry)</span></span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={!station} className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"><option value="">Select a charger</option>{chargers.map((charger) => <option key={charger.id} value={charger.id}>{charger.id} · {charger.status} · {charger.power_kw} kW</option>)}</select></label>
}
