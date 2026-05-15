'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { publishService } from '../services/publishService'
import type { CreatePublishInput, ListPublishQuery } from '../types'

export const publishKeys = {
  all: ['publish'] as const,
  list: (query?: ListPublishQuery) => [...publishKeys.all, 'list', query] as const,
  detail: (id: string) => [...publishKeys.all, 'detail', id] as const,
}

export function usePublishList(query?: ListPublishQuery) {
  return useQuery({
    queryKey: publishKeys.list(query),
    queryFn: () => publishService.list(query),
    refetchInterval: (q) => {
      const inflight = q.state.data?.list.some(r =>
        ['PENDING', 'SCHEDULED', 'DISPATCHED', 'IN_PROGRESS', 'REVIEW_PENDING'].includes(r.status),
      )
      return inflight ? 5_000 : false
    },
  })
}

export function useCreatePublish() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePublishInput) => publishService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: publishKeys.all })
      toast.success('Đã tạo publish task')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Tạo publish thất bại')
    },
  })
}

export function useCancelPublish() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => publishService.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: publishKeys.all })
      toast.success('Đã huỷ publish')
    },
  })
}
