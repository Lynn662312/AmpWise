export type StationLevel = "low" | "moderate" | "high" | "unavailable"

export type StationForecast = {
  time: string
  predicted_wait_min: number | null
  level: StationLevel
}

export type ChargingStation = {
  id: string
  name: string
  location: string
  lat: number
  lon: number
  n_chargers: number
  n_working: number
  power_kw: number
  predicted_wait_min: number | null
  level: StationLevel
  forecast: StationForecast[]
}

export type StationFilter = "all" | StationLevel
