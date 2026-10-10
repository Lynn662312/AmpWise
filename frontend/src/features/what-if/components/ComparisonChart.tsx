import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card } from "@/components/ui/card"
import { AnimatedNumber } from "@/components/common/AnimatedNumber"
import { getCurrencyCode } from "@/lib/simulationConfig"

export function ComparisonChart({ title, description, before, after, unit, currency = false, formatter }: { title: string; description: string; before: number; after: number; unit: string; currency?: boolean; formatter: (value: number) => string }) {
  const data = [{ label: "Before", value: before }, { label: "After", value: after }]
  const displayUnit = currency ? getCurrencyCode() : unit
  const formatProps = currency ? { prefix: `${displayUnit} ` } : { suffix: ` ${unit}` }
  return <Card className="p-5 sm:p-6"><div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><div className="mt-6 h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} /><Tooltip cursor={{ fill: "var(--muted)" }} formatter={(value) => [`${formatter(Number(value))} ${displayUnit}`, "Estimate"]} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 12 }} /><Bar dataKey="value" fill="var(--brand-green)" radius={[8, 8, 0, 0]} maxBarSize={54} /></BarChart></ResponsiveContainer></div><div className="flex justify-between border-t border-border pt-3 text-xs text-muted-foreground"><span>Before action <strong className="ml-1 text-foreground"><AnimatedNumber value={before} {...formatProps} /></strong></span><span>After action <strong className="ml-1 text-success"><AnimatedNumber value={after} {...formatProps} /></strong></span></div></Card>
}
