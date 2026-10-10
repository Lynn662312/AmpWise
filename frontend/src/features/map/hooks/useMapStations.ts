import { useQuery } from "@tanstack/react-query"
import { fetchStations } from "@/services/station-service"
import { useSimulatedTime } from "@/context/TimeContext"

export function useMapStations() {
  const { selectedTime } = useSimulatedTime()
  return useQuery({
    queryKey: ["stations", "map", selectedTime],
    queryFn: () => fetchStations(selectedTime),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
