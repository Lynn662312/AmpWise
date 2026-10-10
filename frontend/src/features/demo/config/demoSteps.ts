export const demoSteps = [
  { title: "Map overview", label: "Network context", description: "Inspect the selected station and its predicted demand context.", route: (stationId: string, chargerId: string) => `/map?station=${stationId}` },
  { title: "Action prioritization", label: "Safety-first actions", description: "Review the ranked intervention queue and potential revenue risk.", route: () => "/actions" },
  { title: "Charger health", label: "Evidence", description: "Compare delivered power with the charger baseline.", route: (_stationId: string, chargerId: string) => `/chargers/${chargerId}` },
  { title: "What-if simulator", label: "Repair scenario", description: "Run the repair scenario and compare projected outcomes.", route: (stationId: string, chargerId: string) => `/what-if?station=${stationId}&charger=${chargerId}` },
  { title: "Results & impact", label: "Evaluation", description: "Close with queue savings, revenue protection and model performance.", route: () => "/results" },
] as const
