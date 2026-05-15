'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inboxService } from '../services/inboxService'
import type {
  ListCommentsQuery,
  MarkCommentInput,
  ReplyCommentInput,
} from '../types'

export const inboxKeys = {
  all: ['inbox'] as const,
  list: (query?: ListCommentsQuery) => [...inboxKeys.all, 'list', query] as const,
  detail: (id: string) => [...inboxKeys.all, 'detail', id] as const,
}

export function useComments(query?: ListCommentsQuery) {
  return useQuery({
    queryKey: inboxKeys.list(query),
    queryFn: () => inboxService.list(query),
    refetchInterval: 30_000,
  })
}

export function useComment(id: string | undefined) {
  return useQuery({
    queryKey: inboxKeys.detail(id ?? ''),
    queryFn: () => inboxService.getById(id as string),
    enabled: Boolean(id),
  })
}

export function useReplyComment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ReplyCommentInput) => inboxService.reply(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inboxKeys.all })
      toast.success('Đã gửi reply')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Gửi reply thất bại')
    },
  })
}

export function useMarkComment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MarkCommentInput) => inboxService.mark(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inboxKeys.all })
      toast.success('Đã cập nhật trạng thái')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Cập nhật trạng thái thất bại')
    },
  })
}

export function useDeleteComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => inboxService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inboxKeys.all })
      toast.success('Đã xoá comment')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Xoá comment thất bại')
    },
  })
}
