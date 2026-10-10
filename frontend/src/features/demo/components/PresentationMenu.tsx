import { useEffect, useRef, useState } from "react"
import { ChevronRight, Clapperboard, Play, Presentation, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isApiMode } from "@/services/api-client"
import { demoScenarios, type DemoScenarioId } from "@/features/demo/config/scenarios"
import { useDemoMode } from "@/features/demo/context/DemoContext"
import { useSimulatedTime } from "@/context/TimeContext"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"

export function PresentationMenu() {
  const navigate = useNavigate()
  const { setSelectedTime } = useSimulatedTime()
  const { presentationMode, guidedDemo, scenarioId, setScenarioId, setPresentationMode, startGuidedDemo, exitGuidedDemo } = useDemoMode()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const selectScenario = (id: DemoScenarioId) => {
    const scenario = demoScenarios.find((item) => item.id === id)
    if (!scenario || isApiMode) return
    setScenarioId(id)
    setPresentationMode(true)
    setSelectedTime(scenario.time)
    navigate(scenario.route)
    setOpen(false)
  }

  useEffect(() => {
    const handlePointer = (event: MouseEvent) => { if (open && menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false) }
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", handlePointer)
    document.addEventListener("keydown", handleKey)
    return () => { document.removeEventListener("mousedown", handlePointer); document.removeEventListener("keydown", handleKey) }
  }, [open])

  return <div ref={menuRef} className="relative"><Button variant={presentationMode ? "forest" : "soft"} className="px-3 py-2 text-xs" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog"><Presentation size={15} /><span className="hidden sm:inline">{presentationMode ? "Presentation" : "Present"}</span></Button>{open && <div className="absolute right-0 top-12 z-[1000] w-[min(23rem,calc(100vw-2rem))] rounded-[1.5rem] border border-border bg-popover p-4 text-popover-foreground shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">Presentation mode</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A focused walkthrough for the AmpWise operator workflow.</p></div><button type="button" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-full bg-muted" aria-label="Close presentation menu"><X size={15} /></button></div><div className="mt-4 grid gap-2"><button type="button" onClick={() => { const scenario = demoScenarios.find((item) => item.id === scenarioId) ?? demoScenarios[0]; setSelectedTime(scenario.time); startGuidedDemo(); navigate(scenario.route); setOpen(false) }} className="flex items-center gap-3 rounded-2xl bg-primary p-3 text-left text-primary-foreground"><span className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground"><Play size={16} fill="currentColor" /></span><span className="flex-1"><span className="block text-sm font-semibold">Start Guided Demo</span><span className="mt-0.5 block text-[11px] text-primary-foreground/65">Map → Actions → Health → What-if → Results</span></span><ChevronRight size={16} /></button><p className="pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Choose demo scenario</p>{demoScenarios.map(({ id, name, description, icon: Icon }) => <button key={id} type="button" disabled={isApiMode} onClick={() => selectScenario(id)} className={cn("flex items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45", scenarioId === id && "bg-brand-soft")}><span className="grid size-9 place-items-center rounded-full bg-brand-soft text-primary"><Icon size={16} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{name}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{description}</span></span></button>)}{isApiMode && <p className="text-[11px] leading-5 text-muted-foreground">Scenario presets are disabled in API mode because the backend does not expose scenario overrides.</p>}<div className="mt-2 flex items-center justify-between border-t border-border pt-3">{guidedDemo ? <button type="button" onClick={() => { exitGuidedDemo(); setOpen(false) }} className="text-xs font-semibold text-destructive">Exit guided demo</button> : <span className="text-xs text-muted-foreground">{presentationMode ? "Focused workspace active" : "Presentation mode is off"}</span>}{presentationMode && <button type="button" onClick={() => { setPresentationMode(false); setOpen(false) }} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Exit presentation mode</button>}</div></div></div>}</div>
}
