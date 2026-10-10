import { FlaskConical, Radio } from "lucide-react"
import { cn } from "@/lib/utils"

export function DataSourceBadge({ mock, mockLabel = "Demo data", liveLabel = "Live data" }: { mock: boolean; mockLabel?: string; liveLabel?: string }) {
  return <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold", mock ? "bg-warning/15 text-warning" : "bg-success/15 text-success")}>
    {mock ? <FlaskConical size={14} /> : <Radio size={14} />}
    {mock ? mockLabel : liveLabel}
  </span>
}
