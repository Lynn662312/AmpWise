export function formatNumber(value: number, maximumFractionDigits = 1, locale = "en-US") {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)
}

export function formatPercent(value: number) {
  return `${formatNumber(value <= 1 ? value * 100 : value, 0)}%`
}

const CALIFORNIA_TIME_ZONE = "America/Los_Angeles"
const forecastDateFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: CALIFORNIA_TIME_ZONE })
const forecastDayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: CALIFORNIA_TIME_ZONE })
const forecastTimeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: CALIFORNIA_TIME_ZONE })
const forecastDateKeyFormatter = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: CALIFORNIA_TIME_ZONE })

function parseTimestamp(value: string | null | undefined) {
  if (!value) return null
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? null : timestamp
}

export function formatForecastDate(value: string | null | undefined) {
  const timestamp = parseTimestamp(value)
  return timestamp ? forecastDateFormatter.format(timestamp) : "Time unavailable"
}

export function formatForecastSlotTime(value: string | null | undefined, referenceValue?: string | null) {
  const timestamp = parseTimestamp(value)
  if (!timestamp) return "Time unavailable"
  const time = forecastTimeFormatter.format(timestamp)
  const reference = parseTimestamp(referenceValue)
  if (!reference || forecastDateKeyFormatter.format(reference) === forecastDateKeyFormatter.format(timestamp)) return time
  return `${time} · ${forecastDayFormatter.format(timestamp)}`
}
