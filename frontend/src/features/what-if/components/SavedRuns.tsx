import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { SimulationResponse } from "@/features/what-if/types"
import { fetchScenarios, saveScenario, type SimulationInput } from "@/services/what-if-service"

/** Saved what-if runs: keep the one on screen, and list the earlier ones, newest first. */
export function SavedRuns({ name, request, result }: { name: string; request: SimulationInput | undefined; result: SimulationResponse | undefined }) {
  const queryClient = useQueryClient()
  const saved = useQuery({ queryKey: ["scenarios"], queryFn: ({ signal }) => fetchScenarios(signal), staleTime: 60_000, refetchOnWindowFocus: false })
  const save = useMutation({
    mutationFn: () => request && result ? saveScenario(name, request, result) : Promise.reject(new Error("Run a scenario first.")),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scenarios"] }),
  })
  const runs = saved.data ?? []

  return <Card className="p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><Bookmark size={18} /></span>
        <div>
          <h2 className="text-lg font-semibold">Saved runs</h2>
          <p className="mt-1 text-xs text-muted-foreground">Keep a result to compare it with another decision later.</p>
        </div>
      </div>
      <Button variant="soft" className="text-xs" onClick={() => save.mutate()} disabled={!request || !result || save.isPending}>{save.isPending ? "Saving…" : "Save this run"}</Button>
    </div>
    {save.isError && <p className="mt-3 text-xs text-warning" role="alert">Could not save this run. {save.error instanceof Error ? save.error.message : ""}</p>}
    <div className="mt-5 space-y-2">
      {saved.isLoading ? <div className="h-16 animate-pulse rounded-2xl bg-muted" />
        : saved.isError ? <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Saved runs are currently unavailable.</p>
        : runs.length === 0 ? <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No saved run yet. Run a scenario, then save it here.</p>
        : runs.map((run) => <div key={run.id} className="rounded-2xl bg-muted p-4">
          <p className="text-sm font-semibold">{run.name}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{run.result.summary}</p>
        </div>)}
    </div>
  </Card>
}
