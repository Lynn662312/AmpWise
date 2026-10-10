import { fetchActions } from "@/services/action-service"
import { fetchBacktest } from "@/services/backtest-service"
import { fetchChargerHealth } from "@/services/charger-service"
import { fetchStationForecast, fetchStations } from "@/services/station-service"
import { fetchMeta } from "@/services/system-service"
import { getMockMeta, getMockSessions } from "@/services/mockService"
import { isApiMode } from "@/services/api-client"
import { postWhatIf, type SimulationInput } from "@/services/what-if-service"

export const dataService = {
  getStations: fetchStations,
  getStationForecast: fetchStationForecast,
  getChargerHealth: fetchChargerHealth,
  getActions: fetchActions,
  runWhatIf: postWhatIf,
  getBacktest: fetchBacktest,
  getSessions: async () => getMockSessions(),
  getMeta: async () => isApiMode ? fetchMeta() : getMockMeta(),
}

export type { SimulationInput }
