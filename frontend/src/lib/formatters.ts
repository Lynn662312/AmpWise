export function formatNumber(value: number, maximumFractionDigits = 1, locale = "en-MY") {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)
}

export function formatRm(value: number) {
  return `RM ${formatNumber(value, 0)}`
}

export function formatPercent(value: number) {
  return `${formatNumber(value <= 1 ? value * 100 : value, 0)}%`
}
