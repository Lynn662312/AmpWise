import { mockActions } from "@/mocks/actions"
import type { Action } from "@/features/actions/types"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000"

export async function fetchActions(timeMinutes: number, limit = 50): Promise<{ actions: Action[]; source: "api" | "mock" }> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/actions?time=${encodeURIComponent(String(timeMinutes))}&limit=${limit}`, { signal: AbortSignal.timeout(3500) })
    if (!response.ok) throw new Error(`Request failed: ${response.status}`)
    return { actions: await response.json() as Action[], source: "api" }
  } catch {
    return { actions: mockActions, source: "mock" }
  }
}
