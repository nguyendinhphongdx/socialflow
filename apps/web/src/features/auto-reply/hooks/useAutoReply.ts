'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { autoReplyService } from '../services/autoReplyService'
import type {
  CreateAutoReplyRuleInput,
  ListRulesQuery,
  UpdateAutoReplyRuleInput,
} from '../types'

export const autoReplyKeys = {
  all: ['auto-reply'] as const,
  list: (query?: ListRulesQuery) => [...autoReplyKeys.all, 'list', query] as const,
  detail: (id: string) => [...autoReplyKeys.all, 'detail', id] as const,
}

export function useRules(query?: ListRulesQuery) {
  return useQuery({
    queryKey: autoReplyKeys.list(query),
    queryFn: () => autoReplyService.list(query),
  })
}

export function useRule(id: string | undefined) {
  return useQuery({
    queryKey: autoReplyKeys.detail(id ?? ''),
    queryFn: () => autoReplyService.getById(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAutoReplyRuleInput) => autoReplyService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: autoReplyKeys.all })
      toast.success('Đã tạo rule')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Tạo rule thất bại')
    },
  })
}

export function useUpdateRule(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateAutoReplyRuleInput) => autoReplyService.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: autoReplyKeys.all })
      qc.invalidateQueries({ queryKey: autoReplyKeys.detail(id) })
      toast.success('Đã cập nhật rule')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Cập nhật rule thất bại')
    },
  })
}

export function useDeleteRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => autoReplyService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: autoReplyKeys.all })
      toast.success('Đã xoá rule')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Xoá rule thất bại')
    },
  })
}

export function useToggleRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => autoReplyService.toggle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: autoReplyKeys.all })
      toast.success('Đã đổi trạng thái rule')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Đổi trạng thái thất bại')
    },
  })
}
