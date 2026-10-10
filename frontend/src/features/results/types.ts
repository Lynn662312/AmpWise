export type BacktestResult = {
  queue_minutes_saved: number
  rm_protected: number
  forecast_mae_ours: number
  forecast_mae_baseline: number
  fault_precision: number
  fault_recall: number
  daily: { date: string; wait_baseline_min: number; wait_ours_min: number }[]
  week_label: string
}

export type EvaluationWeek = {
  value: string
  label: string
}

export type BacktestResponse = {
  result: BacktestResult
  source: "api" | "mock"
}
