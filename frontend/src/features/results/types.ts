export type BacktestResult = {
  queue_minutes_saved: number
  rm_protected: number
  forecast_mae_ours: number
  forecast_mae_baseline: number
  fault_precision: number
  fault_recall: number
}

export type EvaluationWeek = {
  value: string
  label: string
}

export type BacktestResponse = {
  result: BacktestResult
  source: "api" | "mock"
}
