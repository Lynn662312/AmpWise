// Single global demo context (one simulated clock, one currency), driven by `/api/meta`.
// Defaults match the current demo window (California, Dec 2019 – Feb 2020) until meta loads.
let currencyCode = "USD"
let timeZone = "America/Los_Angeles"
let anchorDate = "2019-12-01"
let utcOffset = "-08:00"

export function configureSimulation(meta: { currency?: string; timezone?: string; time_range: { start: string } }) {
  if (meta.currency) currencyCode = meta.currency
  if (meta.timezone) timeZone = meta.timezone
  const match = meta.time_range.start.match(/^(\d{4}-\d{2}-\d{2})T.*?(Z|[+-]\d{2}:\d{2})$/)
  if (match) { anchorDate = match[1]; utcOffset = match[2] === "Z" ? "+00:00" : match[2] }
}

export function getCurrencyCode() {
  return currencyCode
}

export function getTimeZone() {
  return timeZone
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode, maximumFractionDigits: 0 }).format(value)
}

export function isoAtMinutesOfAnchorDay(minutes: number) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0")
  const mm = String(minutes % 60).padStart(2, "0")
  return `${anchorDate}T${hh}:${mm}:00${utcOffset}`
}

export function isoAtMinutesOfSelectedDay(selectedIsoTime: string, minutes: number) {
  const match = selectedIsoTime.match(/^(\d{4}-\d{2}-\d{2})T.*?(Z|[+-]\d{2}:\d{2})$/)
  const date = match?.[1] ?? anchorDate
  const offset = match?.[2] === "Z" ? "+00:00" : match?.[2] ?? utcOffset
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0")
  const mm = String(minutes % 60).padStart(2, "0")
  return `${date}T${hh}:${mm}:00${offset}`
}
