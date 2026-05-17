'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { brandMonitorService } from '../services/brand-monitor.service'
import type { ListBrandMentionQuery } from '../types'

export const brandMentionKeys = {
  all: ['brand-mention'] as const,
  list: (query?: ListBrandMentionQuery) => [...brandMentionKeys.all, 'list', query] as const,
  detail: (id: string) => [...brandMentionKeys.all, 'detail', id] as const,
}

export function useBrandMentions(query?: ListBrandMentionQuery) {
  return useQuery({
    queryKey: brandMentionKeys.list(query),
    queryFn: () => brandMonitorService.listMentions(query),
  })
}

export function useAckBrandMention() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => brandMonitorService.ackMention(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandMentionKeys.all })
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Ack thất bại')
    },
  })
}

export function useArchiveBrandMention() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => brandMonitorService.archiveMention(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandMentionKeys.all })
      toast.success('Đã lưu trữ mention')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Archive thất bại')
    },
  })
}
