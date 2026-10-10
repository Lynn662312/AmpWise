import { Check, ChevronDown, Search } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { AppFormField, fieldDescribedBy } from "@/components/common/AppFormField"
import type { AppFieldSize } from "@/components/common/AppTextField"
import { cn } from "@/lib/utils"

export interface AppSelectOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

interface AppSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: readonly AppSelectOption[]
  placeholder?: string
  label?: string
  description?: string
  error?: string
  disabled?: boolean
  required?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  emptyMessage?: string
  size?: AppFieldSize
  className?: string
}

const sizeClasses: Record<AppFieldSize, string> = { sm: "h-9 text-xs", default: "h-11 text-sm", lg: "h-[52px] text-base" }

export function AppSelect({ value, onValueChange, options, placeholder = "Select an option", label, description, error, disabled, required, searchable = false, searchPlaceholder = "Search options…", emptyMessage = "No options found.", size = "default", className }: AppSelectProps) {
  const generatedId = useId()
  const fieldId = `app-select-${generatedId}`
  const listId = `${fieldId}-list`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const selected = options.find((option) => option.value === value)
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options
    return options.filter((option) => `${option.label} ${option.description ?? ""}`.toLowerCase().includes(normalized))
  }, [options, query])

  const updatePosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 16)
    const panelHeight = Math.min(panelRef.current?.offsetHeight ?? 300, 320)
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
    const below = window.innerHeight - rect.bottom
    const top = below < panelHeight + 12 && rect.top > panelHeight + 12 ? rect.top - panelHeight : rect.bottom + 8
    setPosition({ top, left, width })
  }

  useLayoutEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(updatePosition)
    return () => window.cancelAnimationFrame(frame)
  }, [open, filteredOptions.length])

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); return }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") return
      if ((event.target as HTMLElement)?.tagName === "INPUT" && event.key !== "Enter") return
      event.preventDefault()
      if (event.key === "Enter") {
        const option = filteredOptions[activeIndex]
        if (option && !option.disabled) { onValueChange(option.value); setOpen(false); triggerRef.current?.focus() }
        return
      }
      if (!filteredOptions.length) return
      const direction = event.key === "ArrowDown" ? 1 : -1
      let next = activeIndex
      for (let i = 0; i < filteredOptions.length; i += 1) {
        next = (next + direction + filteredOptions.length) % filteredOptions.length
        if (!filteredOptions[next]?.disabled) { setActiveIndex(next); break }
      }
    }
    document.addEventListener("mousedown", closeOnOutside)
    document.addEventListener("keydown", handleKey)
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => { document.removeEventListener("mousedown", closeOnOutside); document.removeEventListener("keydown", handleKey); window.removeEventListener("resize", updatePosition); window.removeEventListener("scroll", updatePosition, true) }
  }, [activeIndex, filteredOptions, onValueChange, open])

  useEffect(() => {
    if (open) {
      const selectedIndex = filteredOptions.findIndex((option) => option.value === value)
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : Math.max(0, filteredOptions.findIndex((option) => !option.disabled)))
      if (searchable) window.setTimeout(() => searchRef.current?.focus(), 0)
    } else setQuery("")
  }, [open])

  const openSelect = () => { if (!disabled) setOpen(true) }
  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); openSelect() }
  }

  return <AppFormField id={fieldId} label={label} description={description} error={error} required={required} className={className}>
    <button ref={triggerRef} id={fieldId} type="button" role="combobox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-haspopup="listbox" aria-required={required} aria-invalid={error ? true : undefined} aria-describedby={fieldDescribedBy(fieldId, description, error)} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={handleTriggerKeyDown} className={cn("flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 text-left font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-60", sizeClasses[size])}>
      <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span><ChevronDown size={16} className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
    </button>
    {open && position && createPortal(<div ref={panelRef} id={listId} role="listbox" tabIndex={-1} className="fixed z-[var(--z-dropdown)] max-h-[320px] overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl" style={{ top: position.top, left: position.left, width: position.width }}>
      {searchable && <div className="relative mb-1.5"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30" /></div>}
      <div className="max-h-[260px] overflow-y-auto">
        {filteredOptions.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">{emptyMessage}</p>}
        {filteredOptions.map((option, index) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} onMouseEnter={() => setActiveIndex(index)} onClick={() => { if (!option.disabled) { onValueChange(option.value); setOpen(false); triggerRef.current?.focus() } }} className={cn("flex min-h-9 w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition", index === activeIndex && "bg-muted", option.value === value && "text-primary", option.disabled && "cursor-not-allowed opacity-45")}>
          <span className="mt-0.5 w-4 shrink-0">{option.value === value && <Check size={15} />}</span><span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium leading-5 line-clamp-2 whitespace-normal">{option.label}</span>{option.description && <span className="mt-0.5 block break-words text-[11px] leading-4 text-muted-foreground line-clamp-2 whitespace-normal">{option.description}</span>}</span>
        </button>)}
      </div>
    </div>, document.body)}
  </AppFormField>
}
