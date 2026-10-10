import { useQuery } from "@tanstack/react-query"
import { fetchReportCategories } from "@/services/report-service"

export function useReportCategories() {
  return useQuery({
    queryKey: ["report-categories"],
    queryFn: ({ signal }) => fetchReportCategories(signal),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}
