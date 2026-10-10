import { useQuery } from "@tanstack/react-query"
import { useSimulatedTime } from "@/context/TimeContext"
import { fetchChargerEvents } from "@/services/charger-service"

export function useChargerEvents(chargerId: string, days = 14) {
  const { selectedIsoTime, isReady } = useSimulatedTime()
  return useQuery({
    queryKey: ["charger-events", chargerId, selectedIsoTime, days],
    queryFn: ({ signal }) => fetchChargerEvents(chargerId, selectedIsoTime, days, signal),
    enabled: Boolean(chargerId && isReady),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
