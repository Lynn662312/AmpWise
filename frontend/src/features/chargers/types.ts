export type ChargerHealthPoint = {
  time: string
  actual_power_ratio: number | null
  baseline_power_ratio: number | null
  fault_probability: number | null
}

export type ChargerHealth = {
  charger_id: string
  station_id: string
  status: "healthy" | "degraded" | "connector_fault" | "safety_fault" | "unknown"
  p_fault: number | null
  evidence: string[]
  degraded_since: string | null
  series: ChargerHealthPoint[]
}
