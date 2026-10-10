import { Activity, Clock3, TriangleAlert, Zap } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { ChargingStation } from "@/features/map/types"

const kpiDefinitions = [
  { key: "total", label: "Total stations", icon: Zap, tone: "text-primary" },
  { key: "working", label: "Working chargers", icon: Activity, tone: "text-success" },
  { key: "congested", label: "Congested stations", icon: TriangleAlert, tone: "text-warning" },
  { key: "wait", label: "Average predicted wait", icon: Clock3, tone: "text-info" },
] as const

export function MapKpiCards({ stations, loading }: { stations: readonly ChargingStation[]; loading: boolean }) {
  const waitStations = stations.filter(({ predicted_wait_min }) => predicted_wait_min !== null)
  const values = { total: stations.length, working: stations.reduce((sum, station) => sum + station.n_working, 0), congested: stations.filter(({ level }) => level === "high").length, wait: waitStations.length ? Math.round(waitStations.reduce((sum, station) => sum + (station.predicted_wait_min ?? 0), 0) / waitStations.length) : 0 }
  return <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{kpiDefinitions.map(({ key, label, icon: Icon, tone }) => <Card key={key} className="p-4 sm:p-5"><div className="flex items-center justify-between"><span className={`grid h-9 w-9 place-items-center rounded-xl bg-muted ${tone}`}><Icon size={17} /></span>{loading && <span className="h-4 w-10 animate-pulse rounded bg-muted" />}</div><p className="mt-4 text-xs font-medium text-muted-foreground sm:text-sm">{label}</p><p className="mt-1 font-display text-3xl font-semibold sm:text-4xl">{loading ? "—" : key === "wait" ? `${values[key]} min` : values[key]}</p></Card>)}</section>
}
