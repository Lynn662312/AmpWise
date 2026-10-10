import { getMockBacktest } from "@/services/mockService"
import type { BacktestResponse, BacktestResult } from "@/features/results/types"
import { fetchJson, isApiMode } from "@/services/api-client"

export const isBacktestMockMode = !isApiMode

export async function fetchBacktest(week: string, signal?: AbortSignal): Promise<BacktestResponse> {
  if (isBacktestMockMode) {
    const result = getMockBacktest(week)
    if (!result) throw new Error("No evaluation data is available for this week.")
    return { result, source: "mock" }
  }

  // Without a chosen week the backend replays its default week.
  const query = week ? `?week=${encodeURIComponent(week)}` : ""
  return { result: await fetchJson<BacktestResult>(`/api/backtest${query}`, { signal }), source: "api" }
}
