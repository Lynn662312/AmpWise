import { useQuery } from "@tanstack/react-query"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { dataService } from "@/services/dataService"
import { configureSimulation, isoAtMinutesOfSelectedDay } from "@/lib/simulationConfig"
import { isApiMode } from "@/services/api-client"
import type { ApiMeta } from "@/types/api"

type TimeContextValue = {
  selectedTime: number
  selectedIsoTime: string
  timeLabel: string
  isReady: boolean
  timeError: string | null
  demoTimes: ApiMeta["demo_times"]
  setSelectedTime: (minutes: number) => void
  selectDemoTime: (time: string) => void
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

function validateCaliforniaMeta(meta: { corridor_name: string; currency: string; timezone?: string }) {
  const descriptor = `${meta.corridor_name} ${meta.timezone ?? ""}`.toLowerCase()
  if (meta.currency.toUpperCase() !== "USD" || /malaysia|malaysian|kuala lumpur|penang|asia\/kuala_lumpur|plus e1/.test(descriptor)) {
    return "Backend metadata is not configured for the California/US dataset. Set the backend data mode to the California dataset before loading station data."
  }
  return null
}

export function TimeProvider({ children }: { children: ReactNode }) {
  const [selectedTime, setSelectedTime] = useState(0)
  const [selectedIsoTime, setSelectedIsoTime] = useState("")
  const initialized = useRef(false)
  const { data: meta, error: metaQueryError } = useQuery({ queryKey: ["meta"], queryFn: ({ signal }) => dataService.getMeta(signal), staleTime: Infinity, refetchOnWindowFocus: false, retry: false })

  useEffect(() => {
    if (!meta || initialized.current) return
    const metadataError = isApiMode ? validateCaliforniaMeta(meta) : null
    if (metadataError) {
      initialized.current = true
      return
    }
    configureSimulation(meta)
    const supportedDemo = meta.demo_times.find(({ time }) => supportedMinutes(time, meta.time_range.start, meta.time_range.end) !== null)
    const initialIso = supportedDemo?.time ?? meta.time_range.start
    const initialMinutes = minutesFromIso(initialIso)
    if (initialMinutes === null) return
    setSelectedTime(initialMinutes)
    setSelectedIsoTime(initialIso)
    initialized.current = true
  }, [meta])

  const updateSelectedTime = useCallback((minutes: number) => {
    if (!selectedIsoTime) return
    setSelectedTime(minutes)
    setSelectedIsoTime((current) => isoAtMinutesOfSelectedDay(current, minutes))
  }, [selectedIsoTime])

  const selectDemoTime = useCallback((time: string) => {
    if (!meta || supportedMinutes(time, meta.time_range.start, meta.time_range.end) === null) return
    const minutes = minutesFromIso(time)
    if (minutes === null) return
    setSelectedTime(minutes)
    setSelectedIsoTime(time)
  }, [meta])

  const metadataError = meta && isApiMode ? validateCaliforniaMeta(meta) : null
  const timeError = metadataError ?? (metaQueryError instanceof Error ? metaQueryError.message : metaQueryError ? "Simulated-time metadata is unavailable." : null)
  const demoTimes = meta?.demo_times ?? []
  const value = useMemo(() => ({ selectedTime, selectedIsoTime, timeLabel: selectedIsoTime ? formatTime(selectedTime) : "Loading…", isReady: Boolean(meta && selectedIsoTime && !timeError), timeError, demoTimes, setSelectedTime: updateSelectedTime, selectDemoTime }), [demoTimes, meta, selectDemoTime, selectedIsoTime, selectedTime, timeError, updateSelectedTime])
  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>
}

export function useSimulatedTime() {
  const context = useContext(TimeContext)
  if (!context) throw new Error("useSimulatedTime must be used inside TimeProvider")
  return context
}
