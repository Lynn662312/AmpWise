import { mockBacktestResults } from "@/mocks/backtest"
import type { BacktestResponse, BacktestResult } from "@/features/results/types"
import { fetchJson, isApiMode } from "@/services/api-client"

export const isBacktestMockMode = !isApiMode

export async function fetchBacktest(week: string): Promise<BacktestResponse> {
  if (isBacktestMockMode) {
    const result = mockBacktestResults[week]
    if (!result) throw new Error("No evaluation data is available for this week.")
    return { result, source: "mock" }
  }

  return { result: await fetchJson<BacktestResult>(`/api/backtest?week=${encodeURIComponent(week)}`), source: "api" }
}
