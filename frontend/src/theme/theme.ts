export const themeModes = ["light", "dark"] as const
export type ThemeMode = (typeof themeModes)[number]
