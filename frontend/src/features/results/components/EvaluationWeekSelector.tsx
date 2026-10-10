import type { EvaluationWeek } from "@/features/results/types"
import { AppSelect } from "@/components/common/AppSelect"

export function EvaluationWeekSelector({ weeks, value, onChange }: { weeks: readonly EvaluationWeek[]; value: string; onChange: (value: string) => void }) {
  return <AppSelect label="Evaluation week" size="sm" value={value} onValueChange={onChange} placeholder="Select week" options={weeks.map((week) => ({ value: week.value, label: week.label }))} className="min-w-[180px]" />
}
