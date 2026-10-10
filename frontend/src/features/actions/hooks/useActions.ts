import { useQuery } from "@tanstack/react-query"
import { useSimulatedTime } from "@/context/TimeContext"
import { fetchActions } from "@/services/action-service"

export function useActions() {
  const { selectedIsoTime } = useSimulatedTime()
  return useQuery({
    queryKey: ["actions", selectedIsoTime, 50],
    queryFn: ({ signal }) => fetchActions(selectedIsoTime, 50, signal),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
