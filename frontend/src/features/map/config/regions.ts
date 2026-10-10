export type RegionId = "california"

export const regions = [
  { id: "california", label: "California" },
] as const satisfies readonly { id: RegionId; label: string }[]
