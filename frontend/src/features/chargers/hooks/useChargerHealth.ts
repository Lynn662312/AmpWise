import { useQuery } from "@tanstack/react-query"
import type { ChargingStation } from "@/features/map/types"
import { fetchChargerHealth } from "@/services/charger-service"
import { useSimulatedTime } from "@/context/TimeContext"

export function useChargerHealth(chargerId: string, days: number, station: ChargingStation | null) {
  const { selectedIsoTime } = useSimulatedTime()
  const time = selectedIsoTime
  return useQuery({
    queryKey: ["charger-health", chargerId, time, days],
    queryFn: ({ signal }) => fetchChargerHealth(chargerId, days, station, time, signal),
    enabled: Boolean(chargerId && station),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
