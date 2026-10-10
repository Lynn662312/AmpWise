import type { ChargingStation } from "@/features/map/types"

export function StationSelector({ stations, value, onChange }: { stations: readonly ChargingStation[]; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Charging station</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring"><option value="">Select a station</option>{stations.map((station) => <option key={station.id} value={station.id}>{station.name} · {station.location}</option>)}</select></label>
}
