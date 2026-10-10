import { getMockActions } from "@/services/mockService"
import type { Action } from "@/features/actions/types"
import { fetchJson, isApiMode } from "@/services/api-client"

export async function fetchActions(timeMinutes: number, limit = 50): Promise<{ actions: Action[]; source: "api" | "mock" }> {
  if (!isApiMode) return { actions: getMockActions().slice(0, limit), source: "mock" }
  return { actions: await fetchJson<Action[]>(`/api/actions?time=${encodeURIComponent(String(timeMinutes))}&limit=${encodeURIComponent(String(limit))}`), source: "api" }
}
