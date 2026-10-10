import { fetchJson } from "@/services/api-client"

export type ApiMeta = Record<string, unknown>
export type ApiHealth = Record<string, unknown>

export function fetchMeta() {
  return fetchJson<ApiMeta>("/api/meta")
}

export function fetchApiHealth() {
  return fetchJson<ApiHealth>("/api/health")
}
