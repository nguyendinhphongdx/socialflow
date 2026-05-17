'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inboxService } from '../services/inboxService'
import type {
  BulkActionInput,
  BulkActionResult,
  BulkReplyInput,
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

function formatBulkResult(verb: string, r: BulkActionResult): string {
  if (r.failed === 0) return `Đã ${verb} ${r.succeeded}/${r.total}`
  return `Đã ${verb} ${r.succeeded}/${r.total} — ${r.failed} thất bại`
}

export function useBulkReply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: BulkReplyInput) => inboxService.bulkReply(input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: inboxKeys.all })
      const msg = formatBulkResult('reply', result)
      if (result.failed > 0) toast.warning(msg)
      else toast.success(msg)
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Bulk reply thất bại')
    },
  })
}

export function useBulkMarkReplied() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: BulkActionInput) => inboxService.bulkMarkReplied(input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: inboxKeys.all })
      toast.success(formatBulkResult('mark replied', result))
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Bulk mark thất bại')
    },
  })
}

export function useBulkArchive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: BulkActionInput) => inboxService.bulkArchive(input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: inboxKeys.all })
      toast.success(formatBulkResult('archive', result))
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Bulk archive thất bại')
    },
  })
}

export function useBulkDelete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: BulkActionInput) => inboxService.bulkDelete(input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: inboxKeys.all })
      toast.success(formatBulkResult('xoá', result))
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Bulk xoá thất bại')
    },
  })
}
