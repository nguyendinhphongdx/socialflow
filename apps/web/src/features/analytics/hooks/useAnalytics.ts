'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { analyticsService } from '../services/analyticsService'

export const analyticsKeys = {
  all: ['analytics'] as const,
  postInsights: (publishRecordId: string) => [...analyticsKeys.all, 'post', publishRecordId] as const,
  postLatest: (publishRecordId: string) => [...analyticsKeys.all, 'post', publishRecordId, 'latest'] as const,
  accountTimeline: (accountId: string, days: number) =>
    [...analyticsKeys.all, 'account', accountId, 'timeline', days] as const,
}

export function usePostInsights(publishRecordId: string | undefined) {
  return useQuery({
    queryKey: analyticsKeys.postInsights(publishRecordId ?? ''),
    queryFn: () => analyticsService.listPostInsights(publishRecordId as string),
    enabled: Boolean(publishRecordId),
  })
}

export function useLatestPostInsight(publishRecordId: string | undefined) {
  return useQuery({
    queryKey: analyticsKeys.postLatest(publishRecordId ?? ''),
    queryFn: () => analyticsService.getLatestPostInsight(publishRecordId as string),
    enabled: Boolean(publishRecordId),
  })
}

export function useSnapshotPostNow(publishRecordId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => analyticsService.snapshotPostNow(publishRecordId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: analyticsKeys.postInsights(publishRecordId) })
      qc.invalidateQueries({ queryKey: analyticsKeys.postLatest(publishRecordId) })
      toast.success('Đã snapshot insight')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Snapshot thất bại')
    },
  })
}

export function useAccountTimeline(accountId: string | undefined, days: number) {
  return useQuery({
    queryKey: analyticsKeys.accountTimeline(accountId ?? '', days),
    queryFn: () => analyticsService.getAccountTimeline(accountId as string, days),
    enabled: Boolean(accountId),
  })
}
