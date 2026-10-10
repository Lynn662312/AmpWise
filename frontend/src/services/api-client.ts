const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000"

export const isApiMode = import.meta.env.VITE_DATA_SOURCE === "api"

export class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
  }
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, signal: init?.signal ?? AbortSignal.timeout(6000) })
  if (!response.ok) throw new ApiRequestError(`Request failed: ${response.status}`, response.status)
  return response.json() as Promise<T>
}

export function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`
}
