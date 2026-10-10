import type { EvaluationWeek } from "@/features/results/types"

export function EvaluationWeekSelector({ weeks, value, onChange }: { weeks: readonly EvaluationWeek[]; value: string; onChange: (value: string) => void }) {
  return <label className="flex items-center gap-3 rounded-full bg-card px-4 py-2.5 text-xs font-semibold shadow-sm"><span className="whitespace-nowrap text-muted-foreground">Evaluation week</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 bg-transparent text-foreground outline-none"><option value="">Select week</option>{weeks.map((week) => <option key={week.value} value={week.value}>{week.label}</option>)}</select></label>
}
