import { Activity } from "lucide-react"
import { AnimatedNumber } from "@/components/common/AnimatedNumber"
import { Card } from "@/components/ui/card"
import { NetworkPulseVisual } from "@/components/visualizations/NetworkPulseVisual"
import { cn } from "@/lib/utils"

type NetworkStatusCardProps = {
  onlineStations: number
  totalStations: number
  uptime: number
  className?: string
}

export function NetworkStatusCard({ onlineStations, totalStations, uptime, className }: NetworkStatusCardProps) {
  const isOperational = totalStations > 0 && onlineStations >= totalStations
  const isAttentionRequired = totalStations > 0 && onlineStations / totalStations < 0.8
  const heading = isOperational ? "All systems operational" : isAttentionRequired ? "Network attention required" : "Network partially operational"
  const activeRatio = totalStations > 0 ? onlineStations / totalStations : 0
  return <Card className={cn("group overflow-hidden bg-primary p-0 text-primary-foreground", className)}>
    <div className="network-status-tilt flex h-full flex-col" onPointerMove={(event) => { if (!window.matchMedia("(hover: hover)").matches) return; const rect = event.currentTarget.getBoundingClientRect(); const x = ((event.clientX - rect.left) / rect.width - 0.5) * 4; const y = ((event.clientY - rect.top) / rect.height - 0.5) * -4; event.currentTarget.style.setProperty("--network-tilt-x", `${x}deg`); event.currentTarget.style.setProperty("--network-tilt-y", `${y}deg`) }} onPointerLeave={(event) => { event.currentTarget.style.setProperty("--network-tilt-x", "0deg"); event.currentTarget.style.setProperty("--network-tilt-y", "0deg") }}>
      <div className="flex items-start justify-between p-5 sm:p-7"><div><p className="text-sm text-primary-foreground/60">Network status</p><h2 className="mt-2 font-display text-4xl font-semibold leading-none">{heading}</h2></div><span className={cn("pulse-ring grid h-11 w-11 place-items-center rounded-full", isAttentionRequired ? "bg-warning text-primary" : "bg-accent text-primary")}><Activity size={21} /></span></div>
      <NetworkPulseVisual activeRatio={activeRatio} className="mx-5 min-h-32 flex-1 rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 px-4 py-2 sm:mx-7" />
      <div className="flex items-center justify-between p-5 text-sm sm:p-7"><span className="text-primary-foreground/60"><AnimatedNumber value={onlineStations} /> of <AnimatedNumber value={totalStations} /> stations online</span><span className="font-semibold text-accent"><AnimatedNumber value={uptime} decimals={1} suffix="% uptime" /></span></div>
    </div>
  </Card>
}
