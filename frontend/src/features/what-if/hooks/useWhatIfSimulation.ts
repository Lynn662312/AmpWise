import { useMutation } from "@tanstack/react-query"
import { useSimulatedTime } from "@/context/TimeContext"
import { postWhatIf, type SimulationInput } from "@/services/what-if-service"

export function useWhatIfSimulation() {
  const { selectedTime } = useSimulatedTime()
  return useMutation({ mutationKey: ["what-if", selectedTime], mutationFn: (input: SimulationInput) => postWhatIf(input, selectedTime) })
}
