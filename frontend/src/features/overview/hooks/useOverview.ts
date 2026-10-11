import { useQuery } from "@tanstack/react-query"
import { useSimulatedTime } from "@/context/TimeContext"
import { fetchOverview } from "@/services/overview-service"

export function useOverview() {
  const { selectedIsoTime, isReady } = useSimulatedTime()
  return useQuery({
    queryKey: ["overview", selectedIsoTime],
    queryFn: ({ signal }) => fetchOverview(selectedIsoTime, signal),
    enabled: isReady,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
