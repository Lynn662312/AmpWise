export const brandTokens = {
  green: "var(--brand-green)",
  forest: "var(--brand-forest)",
  greenMuted: "var(--brand-green-muted)",
  greenSoft: "var(--brand-green-soft)",
} as const

export const themeTokens = {
  light: {
    background: "var(--background)",
    foreground: "var(--foreground)",
    primary: "var(--primary)",
    primaryForeground: "var(--primary-foreground)",
    accent: "var(--accent)",
    card: "var(--card)",
    muted: "var(--muted)",
  },
  dark: {
    background: "var(--background)",
    foreground: "var(--foreground)",
    primary: "var(--primary)",
    primaryForeground: "var(--primary-foreground)",
    accent: "var(--accent)",
    card: "var(--card)",
    muted: "var(--muted)",
  },
} as const

export type ThemeMode = keyof typeof themeTokens
