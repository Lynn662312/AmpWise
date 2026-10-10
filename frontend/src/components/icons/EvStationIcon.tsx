import type { SVGProps } from "react"

export function EvStationIcon({ size, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h7A1.5 1.5 0 0 1 15 4.5V21M3 21h14M8 7h4M8 11h4M18 8.5V6a1.5 1.5 0 0 1 3 0v7.5a2.5 2.5 0 0 1-2.5 2.5H18M9 21v-4h2v4" />
    </svg>
  )
}
