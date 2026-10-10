import { Activity, BatteryCharging, CalendarDays } from "lucide-react"

export type DemoScenarioId = "normal" | "festive-peak" | "charger-failure"

export type DemoScenario = {
  id: DemoScenarioId
  name: string
  description: string
  icon: typeof CalendarDays
  time: number
  stationId: string
  chargerId: string
  route: string
}

export const demoScenarios: readonly DemoScenario[] = [
  { id: "normal", name: "Normal Operations", description: "A steady day with mostly available capacity.", icon: CalendarDays, time: 480, stationId: "kl-sentral", chargerId: "kl-sentral_c1", route: "/map?station=kl-sentral" },
  { id: "festive-peak", name: "Festive Travel Peak", description: "Higher corridor demand and longer predicted queues.", icon: Activity, time: 1080, stationId: "seremban-north", chargerId: "seremban-north_c1", route: "/map?station=seremban-north" },
  { id: "charger-failure", name: "Charger Failure Impact", description: "Inspect degraded capacity and its operational impact.", icon: BatteryCharging, time: 840, stationId: "muar-rest-stop", chargerId: "muar-rest-stop_c1", route: "/map?station=muar-rest-stop" },
]
