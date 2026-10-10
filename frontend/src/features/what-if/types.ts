export type ScenarioType = "fix_now" | "add_chargers" | "discount"
export type RepairTiming = "fix_now" | "after_peak"

export type WhatIfRequest = {
  scenario: ScenarioType
  station_id: string
  time: string
  charger_id?: string
  n_chargers?: number
  discount_pct?: number
}

export type WhatIfResult = {
  before_wait_min: number
  after_wait_min: number
  before_revenue_rm: number
  after_revenue_rm: number
  // Money at risk (estimated unserved sessions x price). Sent by the API; the local sample data has none.
  before_at_risk_rm?: number
  after_at_risk_rm?: number
  summary: string
}

export type SimulationResponse = WhatIfResult & { source: "api" | "mock" }
