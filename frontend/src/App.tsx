import { useState } from "react"
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Bolt, CalendarDays, ChevronRight, ClipboardCheck, Gauge, LayoutDashboard, Map, Menu, Moon, MoreHorizontal, Search, Settings, Sun, TrendingUp, X } from "lucide-react"
import { EvStationIcon } from "@/components/icons/EvStationIcon"
import { PlugIcon } from "@/components/icons/PlugIcon"
import { NotificationBell } from "@/features/notifications/components/NotificationBell"
import { EmergencyAlertDialog } from "@/features/notifications/components/EmergencyAlertDialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MetricCard } from "@/components/common/MetricCard"
import { DataSourceBadge } from "@/components/common/DataSourceBadge"
import { NetworkStatusCard } from "@/components/common/NetworkStatusCard"
import { FeedbackPieCard } from "@/components/common/FeedbackPieCard"
import { AppSelect } from "@/components/common/AppSelect"
import { useTheme } from "@/theme/ThemeProvider"
import { cn } from "@/lib/utils"
import { MapPage } from "@/features/map/MapPage"
import { useSimulatedTime } from "@/context/TimeContext"
import { ActionsPage } from "@/features/actions/ActionsPage"
import { WhatIfPage } from "@/features/what-if/WhatIfPage"
import { ResultsPage } from "@/features/results/ResultsPage"
import { StationDetailPage } from "@/features/stations/StationDetailPage"
import { ChargerHealthPage } from "@/features/chargers/ChargerHealthPage"
import { ActionDetailDrawer } from "@/features/actions/components/ActionDetailDrawer"
import { useActions } from "@/features/actions/hooks/useActions"
import type { Action } from "@/features/actions/types"
import { useMapStations } from "@/features/map/hooks/useMapStations"
import { PresentationMenu } from "@/features/demo/components/PresentationMenu"
import { DemoStepControls } from "@/features/demo/components/DemoStepControls"
import { useDemoMode } from "@/features/demo/context/DemoContext"
import { getMockStations } from "@/services/mockService"
import { useSystemHealth } from "@/features/system/hooks/useSystemHealth"
import { useReportCategories } from "@/features/reports/hooks/useReportCategories"
import { useOverview } from "@/features/overview/hooks/useOverview"
import { isApiMode } from "@/services/api-client"
import { getTimeZone } from "@/lib/simulationConfig"
import logo from "@/assets/logo.png"

type DashboardStation = { name: string; area: string; status: string; ports: string; load: string; tone: string }
type OverviewStation = { station_id: string; status: string; ports: string; load: string; tone: string }

const navItems = [
  { label: "Overview", to: "/", icon: LayoutDashboard },
  { label: "Map", to: "/map", icon: Map },
  { label: "Actions", to: "/actions", icon: ClipboardCheck },
  { label: "Results", to: "/results", icon: TrendingUp },
]

function App() {
  return <BrowserRouter><AppShell /></BrowserRouter>
}

function AppShell() {
  useSystemHealth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { selectedTime, setSelectedTime, selectedIsoTime, selectDemoTime, demoTimes, timeLabel, isReady, timeError } = useSimulatedTime()
  const { presentationMode } = useDemoMode()

  return (
    <div className="min-h-screen bg-background">
      <aside className={cn("fixed inset-y-0 left-0 z-30 flex w-64 -translate-x-full flex-col bg-sidebar px-5 py-6 text-sidebar-foreground transition-transform lg:translate-x-0", sidebarOpen && "translate-x-0", presentationMode && "lg:-translate-x-full")}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5"><img src={logo} alt="AmpWise" className="size-9 shrink-0 rounded-full object-cover" /><span className="text-lg font-bold tracking-tight">ampwise</span></div>
          <button className="rounded-lg p-1 text-sidebar-foreground/70 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <div className="mt-12 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">Workspace</div>
        <nav className="mt-3 space-y-1">
          {navItems.map(({ label, to, icon: Icon }) => <NavLink key={label} to={to} onClick={() => setSidebarOpen(false)} className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground", isActive && "bg-accent text-primary hover:bg-accent hover:text-primary")}><Icon size={18} /><span>{label}</span></NavLink>)}
        </nav>
        <div className="mt-auto space-y-1">
          <NavLink to="/settings" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"><Settings size={18} /><span>Settings</span></NavLink>
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-sidebar-foreground/10 p-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-bold text-primary">AF</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">user F.</p><p className="truncate text-xs text-sidebar-foreground/55">Operator account</p></div><MoreHorizontal size={17} className="text-sidebar-foreground/50" /></div>
        </div>
      </aside>
      {sidebarOpen && <button className="fixed inset-0 z-20 bg-primary/30 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation overlay" />}
      <main className={cn("transition-[padding] duration-200", !presentationMode && "lg:pl-64")}>
        <header className="flex h-20 items-center justify-between border-b border-border/70 px-5 sm:px-8 lg:px-12">
          <button className="rounded-xl p-2 hover:bg-muted lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"><Map size={16} /><span className="font-semibold text-foreground">Today</span></div>
          <div className="ml-auto flex items-center gap-2"><label className="hidden items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground md:flex">Simulated time <input type="range" min="0" max="1439" step="30" value={selectedTime} onChange={(event) => setSelectedTime(Number(event.target.value))} disabled={!isReady} className="w-28 accent-[var(--accent)] disabled:opacity-50" aria-label="Simulated time" /
          >
            <span className="min-w-14 text-right text-foreground">{timeLabel}</span></label>{demoTimes.length > 1 && <AppSelect value={selectedIsoTime} onValueChange={selectDemoTime} options={demoTimes.map(({ label, time }) => ({ label, value: time }))} placeholder="Demo time" size="sm" className="hidden w-44 md:block" />}
            {/* <PresentationMenu /> */}
          <NotificationBell /><button className="rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button></div>
        </header>
        <div className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 lg:px-12">{timeError && <div className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{timeError}</div>}<Routes><Route path="/map" element={<MapPage />} /><Route path="/actions" element={<ActionsPage />} /><Route path="/what-if" element={<WhatIfPage />} /><Route path="/results" element={<ResultsPage />} /><Route path="/stations/:id" element={<StationDetailPage />} /><Route path="/chargers/:id" element={<ChargerHealthPage />} /><Route path="*" element={<Dashboard />} /></Routes></div>
        <DemoStepControls />
      </main>
      <EmergencyAlertDialog />
    </div>
  )
}

function Dashboard() {
  const { selectedIsoTime, isReady } = useSimulatedTime()
  const { data: actionData, isLoading: actionsLoading, isError: actionsError } = useActions()
  const { data: stationData, isLoading: stationsLoading, isError: stationsError } = useMapStations()
  const { data: reportData, isLoading: feedbackLoading, isError: feedbackError } = useReportCategories()
  const { data: overviewData, isLoading: overviewLoading, isError: overviewError } = useOverview()
  const [selectedAlert, setSelectedAlert] = useState<Action | null>(null)
  const apiStations = stationData?.stations ?? []
  const stationSummary = stationsLoading || stationsError || !stationData ? {
    active_stations: null,
    total_stations: null,
    total_chargers: null,
    working_chargers: null,
  } : {
    active_stations: apiStations.filter(({ n_working }) => (n_working ?? 0) > 0).length,
    total_stations: apiStations.length,
    total_chargers: apiStations.reduce((sum, { n_chargers }) => sum + (n_chargers ?? 0), 0),
    working_chargers: apiStations.reduce((sum, { n_working }) => sum + (n_working ?? 0), 0),
  }
  const overviewUnavailable = overviewLoading || overviewError || !overviewData
  const dashboardData = {
    energy_trend: overviewData?.energy_trend ?? [],
    overview_stations: [],
    summary: {
      energy_delivered_kwh: overviewUnavailable ? null : overviewData.energy_delivered_kwh,
      active_stations: stationSummary.active_stations,
      total_stations: stationSummary.total_stations,
      live_sessions: overviewUnavailable ? null : overviewData.live_sessions,
      network_uptime_pct: overviewUnavailable ? null : overviewData.network_uptime_pct,
      weekly_energy_kwh: overviewUnavailable ? null : overviewData.energy_delivered_week_kwh,
    },
  }
  const stationRecords = isApiMode ? apiStations : getMockStations(480)
  const stations = (dashboardData.overview_stations as OverviewStation[]).map((item) => {
    const station = stationRecords.find(({ id }) => id === item.station_id)
    return { ...item, name: station?.name ?? item.station_id, area: station?.location ?? "Location unavailable" }
  })
  const trendData = dashboardData.energy_trend.map(({ date, kwh }) => ({ day: date, energy: kwh }))
  const alerts = (actionData?.actions ?? []).filter(({ issue_type, state }) => state !== "done" && ["safety_fault", "degraded", "connector_fault", "user_reported"].includes(issue_type)).sort((a, b) => a.rank - b.rank).slice(0, 2)
  const stationAvailabilityDescription = isApiMode
    ? stationSummary.working_chargers === null || stationSummary.total_chargers === null ? "Station feed unavailable" : `${stationSummary.working_chargers} of ${stationSummary.total_chargers} chargers working`
    : "network availability"
  const selectedDate = isReady ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: getTimeZone() }).format(new Date(selectedIsoTime)) : "Waiting for supported backend time"
  return <div className="space-y-8">
    <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mb-2 text-sm font-medium text-muted-foreground">{selectedDate}</p><h1 className="font-display text-[1.75rem] font-semibold leading-none tracking-tight sm:text-[2.25rem] lg:text-[2.5rem]">Good morning, user</h1><p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">Here’s your network pulse. Keep the charge moving.</p></div><Button variant="soft"><CalendarDays size={16} />Schedule report</Button></section>
    <section className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">{overviewData && <DataSourceBadge mock={overviewData.data_source === "placeholder"} mockLabel="Backend placeholder data" liveLabel="Backend overview data" />}<span>{overviewUnavailable ? "Overview metrics unavailable" : "Overview metrics from the backend"}</span></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={<Bolt size={20} />} label="Energy delivered" value={dashboardData.summary.energy_delivered_kwh} loading={overviewLoading} suffix=" kWh" description={overviewError ? "Overview API unavailable" : "Current period"} />
      <MetricCard icon={<EvStationIcon size={20} />} label="Stations with working chargers" value={dashboardData.summary.active_stations} suffix={dashboardData.summary.total_stations === null ? undefined : ` / ${dashboardData.summary.total_stations}`} description={stationAvailabilityDescription} trailing={!isApiMode ? <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-primary">75%</span> : undefined} />
      <MetricCard icon={<PlugIcon width={20} height={20} />} label="Live sessions" value={dashboardData.summary.live_sessions} loading={overviewLoading} suffix=" cars" description={overviewError ? "Overview API unavailable" : "Current period"} />
      <MetricCard icon={<Gauge size={20} />} label="Network uptime" value={dashboardData.summary.network_uptime_pct} loading={overviewLoading} decimals={1} suffix="%" description={overviewError ? "Overview API unavailable" : "Current period"} />
    </section>
    <section className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
      <Card className="min-h-[355px] p-5 sm:p-7"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-muted-foreground">Energy delivered</p><div className="mt-2 flex items-end gap-2"><h2 className="font-display text-5xl font-semibold">{overviewLoading ? "Loading…" : dashboardData.summary.weekly_energy_kwh === null ? "Unavailable" : dashboardData.summary.weekly_energy_kwh.toLocaleString("en-US")}</h2><span className="mb-1 text-sm text-muted-foreground">{overviewError ? "Overview API unavailable" : dashboardData.summary.weekly_energy_kwh === null ? "Unavailable" : "kWh this week"}</span></div></div><button className="rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted">Last 7 days <ChevronRight className="ml-1 inline" size={14} /></button></div><div className="mt-8 h-48">{overviewLoading ? <div className="h-full animate-pulse rounded-2xl bg-muted" /> : trendData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData}><defs><linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} dy={9} /><YAxis hide domain={[0, 90]} /><Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 12 }} /><Area type="monotone" dataKey="energy" stroke="var(--accent)" strokeWidth={3} fill="url(#energyFill)" /></AreaChart></ResponsiveContainer> : <div className="grid h-full place-items-center rounded-2xl bg-muted text-xs text-muted-foreground">{overviewError ? "Overview energy data unavailable." : "No energy trend data available."}</div>}</div></Card>
      <NetworkStatusCard onlineStations={dashboardData.summary.active_stations} totalStations={dashboardData.summary.total_stations} uptime={dashboardData.summary.network_uptime_pct} alerts={alerts} alertsLoading={actionsLoading} alertsError={actionsError} stationDataLoading={stationsLoading} stationDataError={stationsError} onAlertSelect={setSelectedAlert} />
    </section>
    <section className="grid gap-5 xl:grid-cols-2"><Card className="p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Station performance</h2><p className="mt-1 text-sm text-muted-foreground">A quick look at your busiest locations</p></div><Button variant="ghost" className="px-2 text-xs">View all <ChevronRight size={14} /></Button></div><div className="space-y-2">{stations.length ? stations.map((station) => <StationRow key={station.name} {...station} />) : <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Per-station session data is not available yet.</p>}</div></Card><FeedbackPieCard categories={reportData?.categories ?? []} loading={feedbackLoading} error={feedbackError} /></section>
    <ActionDetailDrawer action={selectedAlert} stations={stationData?.stations ?? []} status="pending" statusSyncEnabled={false} open={Boolean(selectedAlert)} onOpenChange={(open) => { if (!open) setSelectedAlert(null) }} onStatusChange={() => undefined} />
  </div>
}

function StationRow({ name, area, status, ports, load, tone }: DashboardStation) {
  return <div className="flex flex-col gap-3 rounded-2xl p-3 hover:bg-muted/70 sm:flex-row sm:items-center"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><EvStationIcon size={19} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{area}</p></div><div className="flex items-center gap-5 pl-[52px] sm:pl-0"><div><p className="text-xs text-muted-foreground">Ports</p><p className="mt-0.5 text-sm font-semibold">{ports}</p></div><div><p className="text-xs text-muted-foreground">Load</p><p className="mt-0.5 text-sm font-semibold">{load}</p></div><span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", tone === "success" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{status}</span></div></div>
}

export default App
