import * as Dialog from "@radix-ui/react-dialog"
import { Info, Lightbulb, X } from "lucide-react"

const steps = ["The congestion model predicts station arrivals.", "Charger health information identifies potentially unavailable capacity.", "The queueing model estimates waiting times.", "The simulator compares outcomes before and after an operational intervention.", "The estimated difference helps operators evaluate potential financial impact."]

export function MethodologyAccordion() {
  return <Dialog.Root>
    <Dialog.Trigger className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="How is this calculated?"><Info size={18} /></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-primary/25 backdrop-blur-[2px]" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[1.35rem] border border-border bg-card p-5 shadow-2xl outline-none sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-primary"><Lightbulb size={17} /></span><div><Dialog.Title className="text-base font-semibold">How is this calculated?</Dialog.Title><Dialog.Description className="mt-1 text-xs text-muted-foreground">Understand the assumptions behind this scenario.</Dialog.Description></div></div>
          <Dialog.Close className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close"><X size={18} /></Dialog.Close>
        </div>
        <div className="mt-5 grid gap-5 border-t border-border pt-5 md:grid-cols-2">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Method</p><ol className="mt-3 space-y-3">{steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-6"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-primary">{index + 1}</span><span>{step}</span></li>)}</ol></div>
          <div className="rounded-2xl bg-muted p-4 text-sm leading-6 text-muted-foreground"><p className="font-semibold text-foreground">Important assumptions</p><p className="mt-2">Forecasts are estimates. Some Malaysian demand adjustments are assumption-based, charger faults may use modeled telemetry, and revenue depends on a configurable assumed RM value per session.</p></div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
