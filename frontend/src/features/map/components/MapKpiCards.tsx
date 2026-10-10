import { Activity, Clock3, TriangleAlert, Zap } from "lucide-react"
import { MetricCard } from "@/components/common/MetricCard"
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
  return <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{kpiDefinitions.map(({ key, label, icon: Icon, tone }) => <MetricCard key={key} label={label} value={values[key]} icon={<Icon size={17} />} tone={tone} suffix={key === "wait" ? " min" : undefined} loading={loading} />)}</section>
}
