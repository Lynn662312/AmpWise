export function formatNumber(value: number, maximumFractionDigits = 1, locale = "en-US") {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)
}

export function formatPercent(value: number) {
  return `${formatNumber(value <= 1 ? value * 100 : value, 0)}%`
}
