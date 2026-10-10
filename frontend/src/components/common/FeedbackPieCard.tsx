import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts"
import type { PieSectorDataItem } from "recharts"
import { Card } from "@/components/ui/card"
import type { ApiReportCategory } from "@/types/api"

const feedbackColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

const renderActiveShape = (props: PieSectorDataItem) => <Sector {...props} outerRadius={props.outerRadius * 1.1} />

export function FeedbackPieCard({ categories, loading = false, error = false }: { categories: readonly ApiReportCategory[]; loading?: boolean; error?: boolean }) {
  return <Card className="p-5 sm:p-7">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold">Review feedback</h2>
        <p className="mt-1 text-sm text-muted-foreground">Driver complaint categories across the network</p>
      </div>
      <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Recent reviews</span>
    </div>
    <div className="mt-5 grid items-center gap-5 sm:grid-cols-[minmax(170px,0.9fr)_1fr]">
      {loading ? <div className="grid h-52 place-items-center rounded-2xl bg-muted text-xs text-muted-foreground">Loading feedback categories…</div> : error ? <div className="grid h-52 place-items-center rounded-2xl bg-muted p-5 text-center text-xs text-muted-foreground">Feedback categories are unavailable.</div> : !categories.length ? <div className="grid h-52 place-items-center rounded-2xl bg-muted p-5 text-center text-xs text-muted-foreground">No feedback categories are available.</div> : <div className="h-52 min-w-0" aria-label="Review feedback percentage chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {feedbackColors.map((color, index) => <linearGradient key={color} id={`feedback-gradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.96} />
                <stop offset="100%" stopColor={`color-mix(in srgb, ${color} 72%, var(--foreground))`} stopOpacity={0.98} />
              </linearGradient>)}
              <filter id="feedback-pie-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="var(--primary)" floodOpacity="0.16" />
              </filter>
            </defs>
            <Pie data={categories} dataKey="percentage" nameKey="category" cx="50%" cy="50%" innerRadius={0} outerRadius="78%" activeShape={renderActiveShape} paddingAngle={2} stroke="var(--card)" strokeWidth={3} style={{ filter: "url(#feedback-pie-shadow)" }}>
              {categories.map((item, index) => <Cell key={item.category} fill={`url(#feedback-gradient-${index % feedbackColors.length})`} />)}
            </Pie>
            <Tooltip formatter={(value) => [`${value}%`, "Share"]} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>}
      <div className="space-y-3">
        {categories.map((item, index) => <div key={item.category} className="flex items-center gap-3 text-sm">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: feedbackColors[index % feedbackColors.length] }} />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.category}</span>
          <span className="font-semibold tabular-nums">{item.percentage}%</span>
        </div>)}
      </div>
    </div>
  </Card>
}
