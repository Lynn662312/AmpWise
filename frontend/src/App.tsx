import { useState } from "react"
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Activity, Bell, Bolt, CalendarDays, ChevronRight, CircleHelp, ClipboardCheck, Gauge, LayoutDashboard, Map, Menu, Moon, MoreHorizontal, Search, Settings, Sun, TrendingUp, Users, WandSparkles, X } from "lucide-react"
import { EvStationIcon } from "@/components/icons/EvStationIcon"
import { PlugIcon } from "@/components/icons/PlugIcon"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useTheme } from "@/theme/ThemeProvider"
import { cn } from "@/lib/utils"
import { MapPage } from "@/features/map/MapPage"
import { useSimulatedTime } from "@/context/TimeContext"
import { ActionsPage } from "@/features/actions/ActionsPage"
import { WhatIfPage } from "@/features/what-if/WhatIfPage"
import { ResultsPage } from "@/features/results/ResultsPage"

const trendData = [
  { day: "Mon", energy: 31 }, { day: "Tue", energy: 46 }, { day: "Wed", energy: 40 },
  { day: "Thu", energy: 62 }, { day: "Fri", energy: 56 }, { day: "Sat", energy: 78 }, { day: "Sun", energy: 71 },
]

const stations = [
  { name: "AmpWise KL Sentral", area: "Brickfields, Kuala Lumpur", status: "Active", ports: "8 / 12", load: "67%", tone: "success" },
  { name: "AmpWise Bangsar South", area: "Bangsar, Kuala Lumpur", status: "Congested", ports: "6 / 8", load: "88%", tone: "warning" },
  { name: "AmpWise Cyberjaya", area: "Cyberjaya, Selangor", status: "Active", ports: "4 / 10", load: "42%", tone: "success" },
]

const navItems = [
  { label: "Overview", to: "/", icon: LayoutDashboard },
  { label: "Map", to: "/map", icon: Map },
  { label: "Actions", to: "/actions", icon: ClipboardCheck },
  { label: "What-if", to: "/what-if", icon: WandSparkles },
  { label: "Stations", to: "/stations", icon: EvStationIcon },
  { label: "Sessions", to: "/sessions", icon: Activity },
  { label: "Results", to: "/results", icon: TrendingUp },
]

function App() {
  return <BrowserRouter><AppShell /></BrowserRouter>
}

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { selectedTime, setSelectedTime, timeLabel } = useSimulatedTime()

  return (
    <div className="min-h-screen bg-background">
      <aside className={cn("fixed inset-y-0 left-0 z-30 flex w-64 -translate-x-full flex-col bg-sidebar px-5 py-6 text-sidebar-foreground transition-transform lg:translate-x-0", sidebarOpen && "translate-x-0")}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-primary"><Bolt size={19} fill="currentColor" /></span><span className="text-lg font-bold tracking-tight">ampwise</span></div>
          <button className="rounded-lg p-1 text-sidebar-foreground/70 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <div className="mt-12 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">Workspace</div>
        <nav className="mt-3 space-y-1">
          {navItems.map(({ label, to, icon: Icon }) => <NavLink key={label} to={to} onClick={() => setSidebarOpen(false)} className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground", isActive && "bg-accent text-primary hover:bg-accent hover:text-primary")}><Icon size={18} /><span>{label}</span></NavLink>)}
        </nav>
        <div className="mt-auto space-y-1">
          <NavLink to="/settings" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"><Settings size={18} /><span>Settings</span></NavLink>
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-sidebar-foreground/10 p-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-bold text-primary">AF</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Aiman F.</p><p className="truncate text-xs text-sidebar-foreground/55">Operator account</p></div><MoreHorizontal size={17} className="text-sidebar-foreground/50" /></div>
        </div>
      </aside>
      {sidebarOpen && <button className="fixed inset-0 z-20 bg-primary/30 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation overlay" />}
      <main className="lg:pl-64">
        <header className="flex h-20 items-center justify-between border-b border-border/70 px-5 sm:px-8 lg:px-12">
          <button className="rounded-xl p-2 hover:bg-muted lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"><Map size={16} /><span>Malaysia Operations</span><ChevronRight size={14} /><span className="font-semibold text-foreground">Today</span></div>
          <div className="ml-auto flex items-center gap-2"><label className="hidden items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground md:flex">Simulated time <input type="range" min="0" max="1439" step="30" value={selectedTime} onChange={(event) => setSelectedTime(Number(event.target.value))} className="w-28 accent-[var(--accent)]" aria-label="Simulated time" /><span className="min-w-14 text-right text-foreground">{timeLabel}</span></label><button className="hidden rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground sm:block" aria-label="Search"><Search size={19} /></button><button className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Notifications"><Bell size={19} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" /></button><button className="rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button></div>
        </header>
        <div className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 lg:px-12"><Routes><Route path="/map" element={<MapPage />} /><Route path="/actions" element={<ActionsPage />} /><Route path="/what-if" element={<WhatIfPage />} /><Route path="/results" element={<ResultsPage />} /><Route path="*" element={<Dashboard />} /></Routes></div>
      </main>
    </div>
  )
}

function Dashboard() {
  return <div className="space-y-8">
    <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mb-2 text-sm font-medium text-muted-foreground">Saturday, 10 October 2026</p><h1 className="font-display text-5xl font-semibold tracking-tight sm:text-6xl">Good morning, Aiman<span className="text-accent">.</span></h1><p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">Here’s your network pulse. Keep the charge moving.</p></div><Button variant="soft"><CalendarDays size={16} />Schedule report</Button></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={<Bolt />} label="Energy delivered" value="1,284" unit="kWh" change="+12.8%" detail="vs. last week" />
      <MetricCard icon={<EvStationIcon />} label="Active stations" value="18" unit="/ 24" change="75%" detail="network availability" />
      <MetricCard icon={<PlugIcon />} label="Live sessions" value="42" unit="cars" change="+8" detail="since 06:00 today" />
      <MetricCard icon={<Gauge />} label="Network uptime" value="99.2" unit="%" change="Healthy" detail="last 30 days" />
    </section>
    <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
      <Card className="min-h-[355px] p-5 sm:p-7"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-muted-foreground">Energy delivered</p><div className="mt-2 flex items-end gap-2"><h2 className="font-display text-5xl font-semibold">8,492</h2><span className="mb-1 text-sm text-muted-foreground">kWh this week</span></div></div><button className="rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted">Last 7 days <ChevronRight className="ml-1 inline" size={14} /></button></div><div className="mt-8 h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData}><defs><linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} dy={9} /><YAxis hide domain={[0, 90]} /><Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 12 }} /><Area type="monotone" dataKey="energy" stroke="var(--accent)" strokeWidth={3} fill="url(#energyFill)" /></AreaChart></ResponsiveContainer></div></Card>
      <Card className="overflow-hidden bg-primary p-0 text-primary-foreground"><div className="flex items-start justify-between p-5 sm:p-7"><div><p className="text-sm text-primary-foreground/60">Network status</p><h2 className="mt-2 font-display text-4xl font-semibold">All systems go</h2></div><span className="pulse-ring grid h-11 w-11 place-items-center rounded-full bg-accent text-primary"><Activity size={21} /></span></div><div className="mx-5 h-32 rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 sm:mx-7"><div className="relative h-full overflow-hidden opacity-80"><div className="absolute left-[13%] top-[44%] h-1 w-[68%] rotate-[9deg] bg-accent/40" /><div className="absolute left-[25%] top-[31%] h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_14px_var(--accent)]" /><div className="absolute left-[59%] top-[55%] h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_14px_var(--accent)]" /><div className="absolute left-[77%] top-[37%] h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_14px_var(--accent)]" /></div></div><div className="flex justify-between p-5 text-sm sm:p-7"><span className="text-primary-foreground/60">18 online of 24 stations</span><span className="font-semibold text-accent">99.2% uptime</span></div></Card>
    </section>
    <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]"><Card className="p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Station performance</h2><p className="mt-1 text-sm text-muted-foreground">A quick look at your busiest locations</p></div><Button variant="ghost" className="px-2 text-xs">View all <ChevronRight size={14} /></Button></div><div className="space-y-2">{stations.map((station) => <StationRow key={station.name} {...station} />)}</div></Card><QuickActions /></section>
  </div>
}

function MetricCard({ icon, label, value, unit, change, detail }: { icon: React.ReactNode; label: string; value: string; unit: string; change: string; detail: string }) {
  return <Card className="p-5"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-primary"><span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span></span><span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-primary">{change}</span></div><p className="mt-5 text-sm text-muted-foreground">{label}</p><div className="mt-1 flex items-baseline gap-1.5"><span className="font-display text-4xl font-semibold">{value}</span><span className="text-sm font-medium text-muted-foreground">{unit}</span></div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></Card>
}

function StationRow({ name, area, status, ports, load, tone }: (typeof stations)[number]) {
  return <div className="flex flex-col gap-3 rounded-2xl p-3 hover:bg-muted/70 sm:flex-row sm:items-center"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><EvStationIcon size={19} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{area}</p></div><div className="flex items-center gap-5 pl-[52px] sm:pl-0"><div><p className="text-xs text-muted-foreground">Ports</p><p className="mt-0.5 text-sm font-semibold">{ports}</p></div><div><p className="text-xs text-muted-foreground">Load</p><p className="mt-0.5 text-sm font-semibold">{load}</p></div><span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", tone === "success" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{status}</span></div></div>
}

function QuickActions() {
  const actions = [{ label: "Add new station", icon: EvStationIcon }, { label: "Review live sessions", icon: Activity }, { label: "Invite team member", icon: Users }, { label: "Get help from AmpWise", icon: CircleHelp }]
  return <Card className="p-5 sm:p-7"><h2 className="text-lg font-semibold">Quick actions</h2><p className="mt-1 text-sm text-muted-foreground">Keep operations moving</p><div className="mt-5 space-y-2">{actions.map(({ label, icon: Icon }) => <button key={label} className="group flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-muted"><span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-primary group-hover:bg-primary group-hover:text-primary-foreground"><Icon size={17} /></span><span className="flex-1 text-sm font-medium">{label}</span><ChevronRight size={16} className="text-muted-foreground" /></button>)}</div></Card>
}

export default App
