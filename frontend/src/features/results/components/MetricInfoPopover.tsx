import { Info } from "lucide-react"

export function MetricInfoPopover({ label, children }: { label: string; children: string }) {
  return <details className="group relative inline-block align-middle"><summary className="grid size-5 cursor-pointer list-none place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Explain ${label}`}><Info size={13} /></summary><div className="absolute right-0 top-7 z-20 w-56 rounded-2xl border border-border bg-popover p-3 text-left text-xs font-normal leading-5 text-popover-foreground shadow-xl">{children}</div></details>
}
