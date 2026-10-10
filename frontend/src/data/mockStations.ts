import type { ChargingStation, StationLevel } from "@/features/map/types"
import mapData from "@/data/map.json"

type MockStationSeed = Omit<ChargingStation, "forecast" | "predicted_wait_min" | "level"> & { baseWait: number }

const storageKey = "ampwise-map-stations"

function readSeeds(): MockStationSeed[] {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(storageKey)
    if (saved) {
      try {
        return JSON.parse(saved) as MockStationSeed[]
      } catch {
        window.localStorage.removeItem(storageKey)
      }
    }
  }
  return mapData.stations as MockStationSeed[]
}

export function getMapSeedData() {
  return { source: mapData.source, corridor: mapData.corridor, stations: readSeeds() }
}

export function saveMapSeed(station: MockStationSeed) {
  const nextStations = [...readSeeds().filter(({ id }) => id !== station.id), station]
  window.localStorage.setItem(storageKey, JSON.stringify(nextStations))
  return station
}

function getLevel(wait: number | null, working: number) : StationLevel {
  if (!working || wait === null) return "unavailable"
  if (wait >= 25) return "high"
  if (wait >= 15) return "moderate"
  return "low"
}

export function getMockStations(timeMinutes: number): ChargingStation[] {
  const timeFactor = Math.sin(((timeMinutes - 480) / 720) * Math.PI * 2)
  return readSeeds().map(({ baseWait, ...station }) => {
    const predictedWait = station.n_working === 0 ? null : Math.max(2, Math.round(baseWait + timeFactor * 8))
    const level = getLevel(predictedWait, station.n_working)
    return {
      ...station,
      predicted_wait_min: predictedWait,
      level,
      forecast: [
        { time: "Now", predicted_wait_min: predictedWait, level },
        { time: "+1h", predicted_wait_min: station.n_working ? Math.max(2, (predictedWait ?? 0) + 4) : null, level: getLevel(station.n_working ? Math.max(2, (predictedWait ?? 0) + 4) : null, station.n_working) },
        { time: "+2h", predicted_wait_min: station.n_working ? Math.max(2, (predictedWait ?? 0) - 3) : null, level: getLevel(station.n_working ? Math.max(2, (predictedWait ?? 0) - 3) : null, station.n_working) },
      ],
    }
  })
}
