import { Search } from "lucide-react"
import type { StationFilter } from "@/features/map/types"
import { cn } from "@/lib/utils"

const filters: { value: StationFilter; label: string }[] = [
  { value: "all", label: "All stations" },
  { value: "low", label: "Low wait" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High congestion" },
  { value: "unavailable", label: "Unavailable" },
]

export function MapFilters({ query, filter, onQueryChange, onFilterChange, compact = false }: { query: string; filter: StationFilter; onQueryChange: (query: string) => void; onFilterChange: (filter: StationFilter) => void; compact?: boolean }) {
  return <div className={cn("space-y-3", compact && "space-y-2")}><label className={cn("flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus-within:ring-2 focus-within:ring-ring", compact && "border-transparent bg-muted/70 py-2")}><Search className="text-muted-foreground" size={17} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" placeholder="Search stations" aria-label="Search stations" /></label><div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">{filters.map(({ value, label }) => <button key={value} type="button" onClick={() => onFilterChange(value)} className={cn("shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-foreground", filter === value && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground")}>{label}</button>)}</div></div>
}
