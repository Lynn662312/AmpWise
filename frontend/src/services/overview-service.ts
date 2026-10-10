import { getMockOverview } from "@/services/mockService"
import { fetchJson, isApiMode } from "@/services/api-client"
import type { ApiOverview } from "@/types/api"

export async function fetchOverview(signal?: AbortSignal): Promise<ApiOverview> {
  if (!isApiMode) return getMockOverview()
  const overview = await fetchJson<ApiOverview>("/api/overview", { signal })
  if (overview.data_source !== "placeholder" && overview.data_source !== "api") {
    throw new Error("Overview API contract mismatch: unsupported data_source.")
  }
  if (!Array.isArray(overview.energy_trend)) throw new Error("Overview API contract mismatch: energy_trend must be an array.")
  return overview
}
