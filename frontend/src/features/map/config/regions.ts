export type RegionId = "malaysia" | "california"

export const regions = [
  { id: "malaysia", label: "Malaysia" },
  { id: "california", label: "California" },
] as const satisfies readonly { id: RegionId; label: string }[]
