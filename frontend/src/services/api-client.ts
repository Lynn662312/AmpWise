const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000/api")

export const isApiMode = (import.meta.env.VITE_DATA_MODE ?? import.meta.env.VITE_DATA_SOURCE) === "api"

export class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
  }
}

function resolvePath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  if (apiBaseUrl.endsWith("/api") && normalizedPath.startsWith("/api/")) return normalizedPath.slice(4)
  return normalizedPath
}

async function parseError(response: Response) {
  const fallback = `Request failed with status ${response.status}`
  try {
    const payload = await response.json() as { detail?: string | { msg?: string }[]; message?: string; error?: string | { code?: string; message?: string } }
    if (typeof payload.detail === "string") return payload.detail
    if (Array.isArray(payload.detail)) return payload.detail.map((item) => item.msg).filter(Boolean).join("; ") || fallback
    if (typeof payload.error === "object") return payload.error.message ?? payload.error.code ?? fallback
    return payload.message ?? payload.error ?? fallback
  } catch {
    return (await response.text().catch(() => "")) || fallback
  }
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${resolvePath(path)}`, { ...init, signal: init?.signal ?? AbortSignal.timeout(6000) })
  if (!response.ok) throw new ApiRequestError(await parseError(response), response.status)
  return response.json() as Promise<T>
}

export function apiGet<T>(path: string, signal?: AbortSignal) {
  return fetchJson<T>(path, { method: "GET", signal })
}

export function apiPost<TResponse, TBody>(path: string, body: TBody, signal?: AbortSignal) {
  return fetchJson<TResponse>(path, { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
}

export function apiPatch<TResponse, TBody>(path: string, body: TBody, signal?: AbortSignal) {
  return fetchJson<TResponse>(path, { method: "PATCH", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
}

export function apiUrl(path: string) {
  return `${apiBaseUrl}${resolvePath(path)}`
}
