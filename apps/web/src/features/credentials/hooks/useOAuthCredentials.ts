'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { oauthCredentialService } from '../services/oauth-credential.service'
import type { AccountPlatform, OAuthCredentialInput } from '../types'

export const oauthCredentialKeys = {
  all: ['oauth-credentials'] as const,
  list: () => [...oauthCredentialKeys.all, 'list'] as const,
  status: (platform?: AccountPlatform) =>
    [...oauthCredentialKeys.all, 'status', platform ?? 'all'] as const,
}

export function useOAuthCredentials() {
  return useQuery({
    queryKey: oauthCredentialKeys.list(),
    queryFn: () => oauthCredentialService.list(),
  })
}

export function useOAuthCredentialStatus(platform?: AccountPlatform) {
  return useQuery({
    queryKey: oauthCredentialKeys.status(platform),
    queryFn: () => oauthCredentialService.status(platform),
  })
}

export function useUpsertOAuthCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: OAuthCredentialInput) => oauthCredentialService.upsert(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: oauthCredentialKeys.all })
      toast.success('Đã lưu OAuth credential')
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

export function useVerifyOAuthCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => oauthCredentialService.verify(id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: oauthCredentialKeys.all })
      if (result.ok) toast.success('Credential hợp lệ')
      else toast.error(`Verify thất bại: ${result.error ?? 'không xác định'}`)
    },
    onError: () => toast.error('Verify thất bại'),
  })
}

export function useDeleteOAuthCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => oauthCredentialService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: oauthCredentialKeys.all })
      toast.success('Đã xoá credential — fallback về default')
    },
    onError: () => toast.error('Xoá thất bại'),
  })
}
