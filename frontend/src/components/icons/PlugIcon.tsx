import type { SVGProps } from "react"

export function PlugIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="m8 12 8-8M6 14l4 4M4 20l3-3M13 3l8 8M11 5l8 8M5 19l-2 2" />
      <path d="M14.5 9.5 9 15l1.5 1.5a4 4 0 0 0 5.7 0l.8-.8a4 4 0 0 0 0-5.7L15.5 9" />
    </svg>
  )
}
