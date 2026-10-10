import { ArrowLeft, ArrowRight, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { demoScenarios } from "@/features/demo/config/scenarios"
import { demoSteps } from "@/features/demo/config/demoSteps"
import { useDemoMode } from "@/features/demo/context/DemoContext"
import { useSimulatedTime } from "@/context/TimeContext"

export function DemoStepControls() {
  const navigate = useNavigate()
  const { setSelectedTime } = useSimulatedTime()
  const { guidedDemo, step, scenarioId, setStep, exitGuidedDemo } = useDemoMode()
  if (!guidedDemo) return null
  const scenario = demoScenarios.find((item) => item.id === scenarioId) ?? demoScenarios[0]
  const current = demoSteps[step]
  const moveTo = (nextStep: number) => { const next = demoSteps[nextStep]; setStep(nextStep); setSelectedTime(scenario.time); navigate(next.route(scenario.stationId, scenario.chargerId)) }
  return <div className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[900] mx-auto max-w-xl rounded-[1.5rem] bg-primary p-3 text-primary-foreground shadow-2xl sm:inset-x-auto sm:bottom-5 sm:w-[min(38rem,calc(100vw-2rem))] sm:p-4"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-foreground/60">Step {step + 1} of {demoSteps.length} · {current.label}</p><p className="mt-1 truncate text-sm font-semibold">{current.title}</p><p className="mt-0.5 truncate text-[11px] text-primary-foreground/65">{current.description}</p></div><button type="button" onClick={exitGuidedDemo} className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20" aria-label="Exit guided demo"><X size={16} /></button></div><div className="mt-3 flex items-center gap-2"><div className="flex flex-1 gap-1">{demoSteps.map((item, index) => <span key={item.title} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-accent" : "bg-primary-foreground/15"}`} />)}</div><Button variant="ghost" className="px-3 py-2 text-xs text-primary-foreground hover:bg-primary-foreground/10" disabled={step === 0} onClick={() => moveTo(step - 1)}><ArrowLeft size={14} />Back</Button><Button variant="primary" className="px-3 py-2 text-xs" onClick={() => step === demoSteps.length - 1 ? exitGuidedDemo() : moveTo(step + 1)}>{step === demoSteps.length - 1 ? "Finish" : "Next"}<ArrowRight size={14} /></Button></div></div>
}
