import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type { DemoScenarioId } from "@/features/demo/config/scenarios"

type DemoContextValue = {
  presentationMode: boolean
  guidedDemo: boolean
  scenarioId: DemoScenarioId
  step: number
  setPresentationMode: (value: boolean) => void
  startGuidedDemo: () => void
  exitGuidedDemo: () => void
  setScenarioId: (value: DemoScenarioId) => void
  setStep: (value: number) => void
}

const DemoContext = createContext<DemoContextValue | null>(null)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [presentationMode, setPresentationMode] = useState(false)
  const [guidedDemo, setGuidedDemo] = useState(false)
  const [scenarioId, setScenarioId] = useState<DemoScenarioId>("festive-peak")
  const [step, setStep] = useState(0)
  const value = useMemo(() => ({ presentationMode, guidedDemo, scenarioId, step, setPresentationMode, startGuidedDemo: () => { setPresentationMode(true); setGuidedDemo(true); setStep(0) }, exitGuidedDemo: () => setGuidedDemo(false), setScenarioId, setStep }), [guidedDemo, presentationMode, scenarioId, step])
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemoMode() {
  const context = useContext(DemoContext)
  if (!context) throw new Error("useDemoMode must be used inside DemoProvider")
  return context
}
