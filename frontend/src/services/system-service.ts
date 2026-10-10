import { fetchJson } from "@/services/api-client"
import type { ApiHealth, ApiMeta } from "@/types/api"

export function fetchMeta(signal?: AbortSignal) {
  return fetchJson<ApiMeta>("/api/meta", { signal })
}

export function fetchApiHealth(signal?: AbortSignal) {
  return fetchJson<ApiHealth>("/api/health", { signal })
}
