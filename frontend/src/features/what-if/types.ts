export type ScenarioType = "fix_now" | "add_chargers" | "discount"
export type RepairTiming = "fix_now" | "after_peak"

export type WhatIfRequest = {
  scenario: ScenarioType
  station_id: string
  charger_id: string | null
  n_chargers: number | null
  discount_pct: number | null
  time: string
}

export type WhatIfResult = {
  before_wait_min: number
  after_wait_min: number
  before_revenue_rm: number
  after_revenue_rm: number
  summary: string
}

export type SimulationResponse = WhatIfResult & { source: "api" | "mock" }
