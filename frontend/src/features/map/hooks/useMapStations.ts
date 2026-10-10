import { useQuery } from "@tanstack/react-query"
import { fetchStations } from "@/services/station-service"
import { useSimulatedTime } from "@/context/TimeContext"

export function useMapStations() {
  const { selectedTime, selectedIsoTime } = useSimulatedTime()
  return useQuery({
    queryKey: ["stations", "map", selectedIsoTime],
    queryFn: ({ signal }) => fetchStations(selectedTime, selectedIsoTime, signal),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
