import { useQuery } from "@tanstack/react-query"
import { useSimulatedTime } from "@/context/TimeContext"
import { fetchActions } from "@/services/action-service"

export function useActions() {
  const { selectedTime } = useSimulatedTime()
  return useQuery({
    queryKey: ["actions", selectedTime, 50],
    queryFn: () => fetchActions(selectedTime, 50),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
