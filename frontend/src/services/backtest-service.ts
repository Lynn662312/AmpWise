import { mockBacktestResults } from "@/mocks/backtest"
import type { BacktestResponse, BacktestResult } from "@/features/results/types"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000"
export const isBacktestMockMode = import.meta.env.VITE_DATA_SOURCE !== "api"

export async function fetchBacktest(week: string): Promise<BacktestResponse> {
  if (isBacktestMockMode) {
    const result = mockBacktestResults[week]
    if (!result) throw new Error("No evaluation data is available for this week.")
    return { result, source: "mock" }
  }

  const response = await fetch(`${apiBaseUrl}/api/backtest?week=${encodeURIComponent(week)}`, { signal: AbortSignal.timeout(6000) })
  if (!response.ok) throw new Error(`Backtest request failed: ${response.status}`)
  return { result: await response.json() as BacktestResult, source: "api" }
}
