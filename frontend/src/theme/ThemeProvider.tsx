import { useMemo, type ReactNode } from "react"
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes"
import type { ThemeMode } from "./theme"

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>{children}</NextThemesProvider>
}

export function useTheme() {
  const { resolvedTheme, setTheme } = useNextTheme()
  const theme: ThemeMode = resolvedTheme === "dark" ? "dark" : "light"
  const value = useMemo(() => ({ theme, setTheme: (nextTheme: ThemeMode) => setTheme(nextTheme), toggleTheme: () => setTheme(theme === "light" ? "dark" : "light") }), [setTheme, theme])
  return value
}
