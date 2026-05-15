'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { draftService } from '../services/draftService'
import type {
  CreateDraftInput,
  ListDraftQuery,
  PublishDraftInput,
  UpdateDraftInput,
} from '../types'

export const draftKeys = {
  all: ['drafts'] as const,
  list: (query?: ListDraftQuery) => [...draftKeys.all, 'list', query] as const,
  detail: (id: string) => [...draftKeys.all, 'detail', id] as const,
}

export function useDrafts(query?: ListDraftQuery) {
  return useQuery({
    queryKey: draftKeys.list(query),
    queryFn: () => draftService.list(query),
  })
}

export function useDraft(id: string | undefined) {
  return useQuery({
    queryKey: draftKeys.detail(id ?? ''),
    queryFn: () => draftService.getById(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDraftInput) => draftService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: draftKeys.all })
      toast.success('Đã lưu nháp')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Lưu nháp thất bại')
    },
  })
}

export function useUpdateDraft(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateDraftInput) => draftService.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: draftKeys.all })
      qc.invalidateQueries({ queryKey: draftKeys.detail(id) })
      toast.success('Đã cập nhật nháp')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Cập nhật nháp thất bại')
    },
  })
}

export function useDeleteDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => draftService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: draftKeys.all })
      toast.success('Đã xoá nháp')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Xoá nháp thất bại')
    },
  })
}

export function usePublishDraft(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PublishDraftInput) => draftService.publish(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: draftKeys.all })
      qc.invalidateQueries({ queryKey: ['publish'] })
      toast.success('Đã publish nháp')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Publish nháp thất bại')
    },
  })
}
