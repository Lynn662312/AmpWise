import { useQuery } from "@tanstack/react-query"
import { useSimulatedTime } from "@/context/TimeContext"
import type { ChargingStation } from "@/features/map/types"
import { fetchStationChargers } from "@/services/station-service"

export function useStationChargers(station: ChargingStation | null) {
  const { selectedIsoTime, isReady } = useSimulatedTime()
  return useQuery({
    queryKey: ["station-chargers", station?.id ?? "", selectedIsoTime],
    queryFn: ({ signal }) => fetchStationChargers(station, selectedIsoTime, signal),
    enabled: Boolean(station && isReady),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
