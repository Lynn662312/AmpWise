import { useQuery } from "@tanstack/react-query"
import type { ChargingStation } from "@/features/map/types"
import { fetchChargerHealth } from "@/services/charger-service"

export function useChargerHealth(chargerId: string, days: number, station: ChargingStation | null) {
  return useQuery({
    queryKey: ["charger-health", chargerId, days],
    queryFn: () => fetchChargerHealth(chargerId, days, station),
    enabled: Boolean(chargerId && station),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
