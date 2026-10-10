import { getMockActions } from "@/services/mockService"
import type { Action } from "@/features/actions/types"
import type { ApiAction } from "@/types/api"
import type { ActionAdvice, AdviceLanguage, ActionState } from "@/features/actions/types"
import { fetchJson, isApiMode } from "@/services/api-client"

function normalizeApiActions(payload: ApiAction[]): Action[] {
  if (!Array.isArray(payload)) throw new Error("Action API contract mismatch: expected an array.")
  return payload.map((action) => {
    if (typeof action.report_count !== "number" || !("first_reported_at" in action)) {
      throw new Error(`Action API contract mismatch: ${action.id ?? "unknown action"} is missing report_count or first_reported_at.`)
    }
    return action
  })
}

export async function fetchActions(time: string, limit = 50, signal?: AbortSignal): Promise<{ actions: Action[]; source: "api" | "mock" }> {
  if (!isApiMode) return { actions: getMockActions().slice(0, limit), source: "mock" }
  return { actions: normalizeApiActions(await fetchJson<ApiAction[]>(`/api/actions?time=${encodeURIComponent(time)}&limit=${encodeURIComponent(String(limit))}`, { signal })), source: "api" }
}

export async function fetchActionAdvice(actionId: string, time: string, language: AdviceLanguage, signal?: AbortSignal): Promise<ActionAdvice> {
  if (!isApiMode) throw new Error("AI advice is unavailable in local data mode.")
  return fetchJson<ActionAdvice>(`/api/actions/${encodeURIComponent(actionId)}/advice`, { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ time, language }) })
}

export async function updateActionStatus(actionId: string, state: Exclude<ActionState, "open">, signal?: AbortSignal): Promise<Action> {
  if (!isApiMode || import.meta.env.VITE_ACTION_STATUS_ENABLED !== "true") throw new Error("Persistent action status is unavailable until the backend status route is enabled.")
  return fetchJson<Action>(`/api/actions/${encodeURIComponent(actionId)}/status`, { method: "PATCH", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }) })
}

// Every action is open again and the saved what-if runs are removed, so a demo starts clean.
export async function resetDemo(): Promise<{ cleared_actions: number; cleared_scenarios: number }> {
  return fetchJson("/api/demo/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clear_scenarios: true }) })
}
