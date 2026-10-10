export function DataSourceBadge({ mock, mockLabel = "Demo evaluation dataset", liveLabel = "Backend model evaluation" }: { mock: boolean; mockLabel?: string; liveLabel?: string }) {
  return <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 font-semibold"><span className={`size-2 rounded-full ${mock ? "bg-warning" : "bg-success"}`} aria-hidden="true" />{mock ? mockLabel : liveLabel}</span>
}
