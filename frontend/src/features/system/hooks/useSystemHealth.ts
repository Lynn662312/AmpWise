import { useQuery } from "@tanstack/react-query"
import { fetchApiHealth } from "@/services/system-service"
import { isApiMode } from "@/services/api-client"

export function useSystemHealth() {
  return useQuery({
    queryKey: ["system", "health"],
    queryFn: ({ signal }) => fetchApiHealth(signal),
    enabled: isApiMode,
    staleTime: 30_000,
    refetchInterval: isApiMode ? 60_000 : false,
    refetchOnWindowFocus: false,
  })
}
