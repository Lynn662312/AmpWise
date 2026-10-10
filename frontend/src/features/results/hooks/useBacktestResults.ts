import { useQuery } from "@tanstack/react-query"
import { fetchBacktest } from "@/services/backtest-service"

export function useBacktestResults(week: string) {
  return useQuery({
    queryKey: ["backtest", week],
    queryFn: ({ signal }) => fetchBacktest(week, signal),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
