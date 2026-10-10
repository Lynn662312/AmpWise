import { Activity, BatteryCharging, CalendarDays } from "lucide-react"
import demoScenarioData from "@/data/demo-scenarios.json"

export type DemoScenarioId = "normal" | "festive-peak" | "charger-failure"

export type DemoScenario = {
  id: DemoScenarioId
  name: string
  description: string
  icon: typeof CalendarDays
  time: number
  stationId: string
  chargerId: string | null
  route: string
}

const icons = { normal: CalendarDays, "festive-peak": Activity, "charger-failure": BatteryCharging } as const

export const demoScenarios: readonly DemoScenario[] = demoScenarioData.map((scenario) => ({
  id: scenario.id as DemoScenarioId,
  name: scenario.name,
  description: scenario.description,
  icon: icons[scenario.id as DemoScenarioId],
  time: scenario.time,
  stationId: scenario.station_id,
  chargerId: scenario.charger_id,
  route: scenario.route,
}))
