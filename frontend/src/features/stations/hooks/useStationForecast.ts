import { useQuery } from "@tanstack/react-query"
import { useSimulatedTime } from "@/context/TimeContext"
import { fetchStationForecast } from "@/services/station-service"

export function useStationForecast(stationId: string, start: string, hours = 2) {
  const { selectedTime, selectedIsoTime } = useSimulatedTime()
  return useQuery({
    queryKey: ["forecast", stationId, start, hours, selectedIsoTime],
    queryFn: ({ signal }) => fetchStationForecast(stationId, start, hours, selectedTime, signal),
    enabled: Boolean(stationId && start),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
