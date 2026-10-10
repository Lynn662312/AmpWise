import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import App from "./App"
import { ThemeProvider } from "@/theme/ThemeProvider"
import { TimeProvider } from "@/context/TimeContext"
import { DemoProvider } from "@/features/demo/context/DemoContext"
import { NotificationProvider } from "@/features/notifications/context/NotificationContext"
import "@/styles/globals.css"
import logo from "@/assets/logo.png"

const setIcon = (rel: "icon" | "apple-touch-icon") => {
  const selector = `link[rel="${rel}"]`
  const link = document.querySelector<HTMLLinkElement>(selector) ?? document.createElement("link")
  link.rel = rel
  link.href = logo
  if (!link.parentElement) document.head.appendChild(link)
}

setIcon("icon")
setIcon("apple-touch-icon")

const queryClient = new QueryClient()

createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={queryClient}><ThemeProvider><TimeProvider><DemoProvider><NotificationProvider><App /></NotificationProvider></DemoProvider></TimeProvider></ThemeProvider></QueryClientProvider></StrictMode>)
