export type StationLevel = "low" | "moderate" | "high" | "unavailable"

export type StationForecast = {
  time: string
  predicted_wait_min: number | null
  level: StationLevel
}

export type ChargingStation = {
  id: string
  name: string
  region: string
  location: string | null
  lat: number
  lon: number
  n_chargers: number | null
  n_working: number | null
  power_kw: number | null
  predicted_wait_min: number | null
  level: StationLevel
  forecast: StationForecast[]
}

export type StationFilter = "all" | StationLevel
