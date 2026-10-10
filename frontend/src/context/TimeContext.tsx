import { useQuery } from "@tanstack/react-query"
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { dataService } from "@/services/dataService"
import { configureSimulation, isoAtMinutesOfSelectedDay } from "@/lib/simulationConfig"

type TimeContextValue = {
  selectedTime: number
  selectedIsoTime: string
  timeLabel: string
  setSelectedTime: (minutes: number) => void
}

const TimeContext = createContext<TimeContextValue | null>(null)

function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const meridiem = hours >= 12 ? "PM" : "AM"
  const displayHour = hours % 12 || 12
  return `${displayHour}:${String(minutes % 60).padStart(2, "0")} ${meridiem}`
}

function minutesFromIso(value: string) {
  const match = value.match(/T(\d{2}):(\d{2})/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

function supportedMinutes(value: string, start: string, end: string) {
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) || timestamp < Date.parse(start) || timestamp > Date.parse(end) ? null : minutesFromIso(value)
}

export function TimeProvider({ children }: { children: ReactNode }) {
  const [selectedTime, setSelectedTime] = useState(8 * 60)
  const [selectedIsoTime, setSelectedIsoTime] = useState(() => "2019-12-01T08:00:00-08:00")
  const initialized = useRef(false)
  const { data: meta } = useQuery({ queryKey: ["meta"], queryFn: ({ signal }) => dataService.getMeta(signal), staleTime: Infinity, refetchOnWindowFocus: false })

  useEffect(() => {
    if (!meta || initialized.current) return
    configureSimulation(meta)
    const nextTime = meta.demo_times.map(({ time }) => supportedMinutes(time, meta.time_range.start, meta.time_range.end)).find((value): value is number => value !== null)
    if (nextTime !== undefined) {
      const demoTime = meta.demo_times.find(({ time }) => supportedMinutes(time, meta.time_range.start, meta.time_range.end) === nextTime)?.time
      setSelectedTime(nextTime)
      if (demoTime) setSelectedIsoTime(demoTime)
    }
    initialized.current = true
  }, [meta])

  const updateSelectedTime = (minutes: number) => {
    setSelectedTime(minutes)
    setSelectedIsoTime((current) => isoAtMinutesOfSelectedDay(current, minutes))
  }

  const value = useMemo(() => ({ selectedTime, selectedIsoTime, timeLabel: formatTime(selectedTime), setSelectedTime: updateSelectedTime }), [selectedIsoTime, selectedTime])
  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>
}

export function useSimulatedTime() {
  const context = useContext(TimeContext)
  if (!context) throw new Error("useSimulatedTime must be used inside TimeProvider")
  return context
}
