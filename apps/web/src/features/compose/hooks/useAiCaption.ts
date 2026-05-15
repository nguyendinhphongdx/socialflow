'use client'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { aiService, type GenerateCaptionInput } from '../services/aiService'

export function useAiCaption() {
  return useMutation({
    mutationFn: (input: GenerateCaptionInput) => aiService.generateCaption(input),
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'AI gen thất bại')
    },
  })
}
