import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import App from "./App"
import { ThemeProvider } from "@/theme/ThemeProvider"
import { TimeProvider } from "@/context/TimeContext"
import { DemoProvider } from "@/features/demo/context/DemoContext"
import "@/styles/globals.css"

const queryClient = new QueryClient()

createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={queryClient}><ThemeProvider><TimeProvider><DemoProvider><App /></DemoProvider></TimeProvider></ThemeProvider></QueryClientProvider></StrictMode>)
