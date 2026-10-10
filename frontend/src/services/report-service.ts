import { getMockReportCategories } from "@/services/mockService"
import { fetchJson, isApiMode } from "@/services/api-client"
import type { ApiReportCategory } from "@/types/api"

export async function fetchReportCategories(signal?: AbortSignal): Promise<{ categories: ApiReportCategory[]; source: "api" | "mock" }> {
  if (!isApiMode) return { categories: getMockReportCategories(), source: "mock" }
  const categories = await fetchJson<ApiReportCategory[]>("/api/reports/categories", { signal })
  if (!Array.isArray(categories)) throw new Error("Report categories API contract mismatch: expected an array.")
  return { categories, source: "api" }
}
