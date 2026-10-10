import type { SVGProps } from "react"

export function EvChargerIcon({ size, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="5" y="3" width="9" height="13" rx="1.5" />
      <path d="M11.3 6.3 8.8 11h2l-.8 4 3.6-5.2h-2l.7-3.5Z" fill="currentColor" stroke="none" />
      <path d="M14 13.5c2 .9 3 2.6 2.2 4.6" />
      <circle cx="16.6" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}
