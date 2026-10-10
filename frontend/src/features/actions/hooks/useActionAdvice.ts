import { useMutation } from "@tanstack/react-query"
import { useSimulatedTime } from "@/context/TimeContext"
import { fetchActionAdvice } from "@/services/action-service"
import type { AdviceLanguage } from "@/features/actions/types"

export function useActionAdvice(actionId: string) {
  const { selectedIsoTime } = useSimulatedTime()
  return useMutation({
    mutationKey: ["action-advice", actionId, selectedIsoTime],
    mutationFn: ({ language }: { language: AdviceLanguage }) => fetchActionAdvice(actionId, selectedIsoTime, language),
  })
}
