import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

type TimeContextValue = {
  selectedTime: number
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

export function TimeProvider({ children }: { children: ReactNode }) {
  const [selectedTime, setSelectedTime] = useState(8 * 60)
  const value = useMemo(() => ({ selectedTime, timeLabel: formatTime(selectedTime), setSelectedTime }), [selectedTime])
  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>
}

export function useSimulatedTime() {
  const context = useContext(TimeContext)
  if (!context) throw new Error("useSimulatedTime must be used inside TimeProvider")
  return context
}
