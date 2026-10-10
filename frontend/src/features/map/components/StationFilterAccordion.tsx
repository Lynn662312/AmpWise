import { useEffect, useId, useRef, useState } from "react"
import { ListFilter } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { StationFilter } from "@/features/map/types"
import { cn } from "@/lib/utils"

const filterOptions: { value: StationFilter; label: string }[] = [
  { value: "all", label: "All stations" },
  { value: "low", label: "Low wait" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High congestion" },
  { value: "unavailable", label: "Unavailable" },
]

export function StationFilterAccordion({ stationCount, filter, onFilterChange }: { stationCount: number; filter: StationFilter; onFilterChange: (filter: StationFilter) => void }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const activeLabel = filterOptions.find((option) => option.value === filter)?.label ?? "All stations"

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setOpen(false)
      triggerRef.current?.focus()
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("mousedown", handlePointerDown)
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("mousedown", handlePointerDown) }
  }, [open])

  const selectFilter = (value: StationFilter) => { onFilterChange(value); setOpen(false) }

  return <div ref={containerRef}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-2xl font-semibold">Stations</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{stationCount} locations in view</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">{activeLabel}</span>
        <button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={panelId} aria-label="Toggle station filters" className={cn("grid size-9 shrink-0 place-items-center rounded-full transition hover:bg-primary hover:text-primary-foreground", open ? "bg-primary text-primary-foreground" : "bg-brand-soft text-primary")}>
          <ListFilter size={16} />
        </button>
      </div>
    </div>
    <div id={panelId} role="region" aria-label="Station filters" className={cn("grid overflow-hidden transition-[grid-template-rows,opacity,transform,margin-top] duration-[250ms] ease-in-out", open ? "mt-3 grid-rows-[1fr] translate-y-0 opacity-100" : "mt-0 grid-rows-[0fr] -translate-y-1 opacity-0")}>
      <div className="min-h-0">
        <div className="flex flex-wrap gap-2 rounded-2xl bg-muted/40 p-3">
          {filterOptions.map(({ value, label }) => <Button key={value} type="button" variant={filter === value ? "forest" : "soft"} onClick={() => selectFilter(value)} className={cn("px-3 py-1.5 text-xs", filter !== value && "text-muted-foreground hover:text-foreground")}>{label}</Button>)}
        </div>
      </div>
    </div>
  </div>
}
