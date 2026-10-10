import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts"
import type { PieSectorDataItem } from "recharts"
import feedbackData from "@/data/feedback.json"
import { Card } from "@/components/ui/card"

type FeedbackItem = {
  category: string
  percentage: number
}

const feedbackColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

const feedback = feedbackData as FeedbackItem[]

const renderActiveShape = (props: PieSectorDataItem) => <Sector {...props} outerRadius={props.outerRadius * 1.1} />

export function FeedbackPieCard() {
  return <Card className="p-5 sm:p-7">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold">Review feedback</h2>
        <p className="mt-1 text-sm text-muted-foreground">How operators and drivers rate the network</p>
      </div>
      <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Recent reviews</span>
    </div>
    <div className="mt-5 grid items-center gap-5 sm:grid-cols-[minmax(170px,0.9fr)_1fr]">
      <div className="h-52 min-w-0" aria-label="Review feedback percentage chart">
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
            <Pie data={feedback} dataKey="percentage" nameKey="category" cx="50%" cy="50%" innerRadius={0} outerRadius="78%" activeShape={renderActiveShape} paddingAngle={2} stroke="var(--card)" strokeWidth={3} style={{ filter: "url(#feedback-pie-shadow)" }}>
              {feedback.map((item, index) => <Cell key={item.category} fill={`url(#feedback-gradient-${index % feedbackColors.length})`} />)}
            </Pie>
            <Tooltip formatter={(value) => [`${value}%`, "Share"]} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-3">
        {feedback.map((item, index) => <div key={item.category} className="flex items-center gap-3 text-sm">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: feedbackColors[index % feedbackColors.length] }} />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.category}</span>
          <span className="font-semibold tabular-nums">{item.percentage}%</span>
        </div>)}
      </div>
    </div>
  </Card>
}
