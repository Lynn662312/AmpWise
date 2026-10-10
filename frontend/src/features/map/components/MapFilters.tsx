import { Search } from "lucide-react"
import { AppTextField } from "@/components/common/AppTextField"
import { cn } from "@/lib/utils"

export function MapFilters({ query, onQueryChange, compact = false }: { query: string; onQueryChange: (query: string) => void; compact?: boolean }) {
  return <AppTextField value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search stations" aria-label="Search stations" startIcon={<Search size={17} />} size={compact ? "sm" : "default"} className={cn(compact && "[&>div>input]:border-transparent [&>div>input]:bg-muted/70")} />
}
