import { useQuery } from "@tanstack/react-query"
import { fetchOverview } from "@/services/overview-service"

export function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: ({ signal }) => fetchOverview(signal),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}
