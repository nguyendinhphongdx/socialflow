'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { aiCredentialService } from '../services/ai-credential.service'
import type { AiCredentialInput, AiProvider } from '../types'

export const aiCredentialKeys = {
  all: ['ai-credentials'] as const,
  list: () => [...aiCredentialKeys.all, 'list'] as const,
  status: (provider?: AiProvider) =>
    [...aiCredentialKeys.all, 'status', provider ?? 'all'] as const,
}

export function useAiCredentials() {
  return useQuery({
    queryKey: aiCredentialKeys.list(),
    queryFn: () => aiCredentialService.list(),
  })
}

export function useAiCredentialStatus(provider?: AiProvider) {
  return useQuery({
    queryKey: aiCredentialKeys.status(provider),
    queryFn: () => aiCredentialService.status(provider),
  })
}

export function useUpsertAiCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AiCredentialInput) => aiCredentialService.upsert(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aiCredentialKeys.all })
      toast.success('Đã lưu AI credential')
    },
    onError: (err: unknown) => {
      const message
        = err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Lưu credential thất bại'
      toast.error(message)
    },
  })
}

export function useVerifyAiCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => aiCredentialService.verify(id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: aiCredentialKeys.all })
      if (result.ok) toast.success('AI credential hợp lệ')
      else toast.error(`Verify thất bại: ${result.error ?? 'không xác định'}`)
    },
    onError: () => toast.error('Verify thất bại'),
  })
}

export function useDeleteAiCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => aiCredentialService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aiCredentialKeys.all })
      toast.success('Đã xoá credential')
    },
    onError: () => toast.error('Xoá thất bại'),
  })
}
