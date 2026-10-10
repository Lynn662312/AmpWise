import { fetchActions } from "@/services/action-service"
import { fetchBacktest } from "@/services/backtest-service"
import { fetchChargerHealth } from "@/services/charger-service"
import { fetchStationForecast, fetchStations } from "@/services/station-service"
import { fetchApiHealth, fetchMeta } from "@/services/system-service"
import { getMockMeta, getMockSessions } from "@/services/mockService"
import { isApiMode } from "@/services/api-client"
import { postWhatIf, type SimulationInput } from "@/services/what-if-service"
import { fetchReportCategories } from "@/services/report-service"
import { fetchOverview } from "@/services/overview-service"

export const dataService = {
  getStations: fetchStations,
  getStationForecast: fetchStationForecast,
  getChargerHealth: fetchChargerHealth,
  getActions: fetchActions,
  runWhatIf: postWhatIf,
  getBacktest: fetchBacktest,
  getSessions: async () => getMockSessions(),
  getMeta: (signal?: AbortSignal) => isApiMode ? fetchMeta(signal) : Promise.resolve(getMockMeta()),
  getHealth: fetchApiHealth,
  getReportCategories: fetchReportCategories,
  getOverview: fetchOverview,
}

export type { SimulationInput }
