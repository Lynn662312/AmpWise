import { useMemo } from "react"

type NetworkPulseVisualProps = {
  activeRatio?: number
  className?: string
}

const paths = [
  "M62 90 C116 52 156 54 205 80",
  "M62 90 C112 119 164 126 205 80",
  "M205 80 C260 38 312 48 358 74",
  "M205 80 C266 104 315 113 358 74",
  "M205 80 C248 78 301 78 358 74",
]

const nodes = [
  { x: 62, y: 90, scale: 0.82 },
  { x: 118, y: 55, scale: 0.68 },
  { x: 118, y: 120, scale: 0.62 },
  { x: 205, y: 80, scale: 1 },
  { x: 274, y: 47, scale: 0.64 },
  { x: 290, y: 111, scale: 0.72 },
  { x: 358, y: 74, scale: 0.86 },
]

export function NetworkPulseVisual({ activeRatio = 1, className }: NetworkPulseVisualProps) {
  const activeNodes = useMemo(() => Math.max(1, Math.round(nodes.length * Math.min(1, Math.max(0, activeRatio)))), [activeRatio])
  return <div className={className} role="img" aria-label="Decorative connected charging network visualization">
    <svg viewBox="0 0 420 160" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <filter id="network-node-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="var(--brand-green)" floodOpacity="0.22" /></filter>
        <linearGradient id="network-line" x1="0" x2="1"><stop offset="0" stopColor="var(--brand-green)" stopOpacity="0.28" /><stop offset="0.5" stopColor="var(--brand-green)" stopOpacity="0.72" /><stop offset="1" stopColor="var(--brand-green)" stopOpacity="0.3" /></linearGradient>
      </defs>
      <ellipse cx="210" cy="138" rx="158" ry="12" fill="var(--brand-green)" opacity="0.08" />
      <g className="network-pulse-paths" fill="none" stroke="url(#network-line)" strokeLinecap="round" strokeWidth="1.5">
        {paths.map((path) => <path key={path} d={path} />)}
      </g>
      <g className="network-pulse-signals" fill="var(--brand-green)">
        {paths.slice(0, 3).map((path, index) => <circle key={path} r={index === 1 ? 2.2 : 1.8} opacity="0.9"><animateMotion dur={`${3.6 + index * 0.45}s`} path={path} repeatCount="indefinite" /></circle>)}
      </g>
      <g className="network-pulse-nodes">
        {nodes.map((node, index) => {
          const active = index < activeNodes
          return <g key={`${node.x}-${node.y}`} transform={`translate(${node.x} ${node.y}) scale(${node.scale})`} className={active ? "network-pulse-node network-pulse-node--active" : "network-pulse-node network-pulse-node--muted"} filter={active ? "url(#network-node-shadow)" : undefined}>
            <circle r="15" fill={active ? "var(--brand-forest)" : "var(--brand-green-muted)"} opacity={active ? 0.98 : 0.7} />
            <circle r="8" fill={active ? "var(--brand-green)" : "var(--brand-green-soft)"} opacity={active ? 1 : 0.34} />
            {index === 3 && <path d="M-3 -6h6l-2 4h4l-7 8 2-5h-4z" fill="var(--brand-forest)" />}
          </g>
        })}
      </g>
    </svg>
  </div>
}
