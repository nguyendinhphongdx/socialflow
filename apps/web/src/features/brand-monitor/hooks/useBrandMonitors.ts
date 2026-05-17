'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { brandMonitorService } from '../services/brand-monitor.service'
import type {
  CreateBrandMonitorInput,
  ListBrandMonitorQuery,
  UpdateBrandMonitorInput,
} from '../types'

export const brandMonitorKeys = {
  all: ['brand-monitor'] as const,
  list: (query?: ListBrandMonitorQuery) => [...brandMonitorKeys.all, 'list', query] as const,
  detail: (id: string) => [...brandMonitorKeys.all, 'detail', id] as const,
}

export function useBrandMonitors(query?: ListBrandMonitorQuery) {
  return useQuery({
    queryKey: brandMonitorKeys.list(query),
    queryFn: () => brandMonitorService.listMonitors(query),
  })
}

export function useBrandMonitor(id: string | undefined) {
  return useQuery({
    queryKey: brandMonitorKeys.detail(id ?? ''),
    queryFn: () => brandMonitorService.getMonitor(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateBrandMonitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateBrandMonitorInput) => brandMonitorService.createMonitor(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandMonitorKeys.all })
      toast.success('Đã tạo brand monitor')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Tạo brand monitor thất bại')
    },
  })
}

export function useUpdateBrandMonitor(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateBrandMonitorInput) => brandMonitorService.updateMonitor(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandMonitorKeys.all })
      qc.invalidateQueries({ queryKey: brandMonitorKeys.detail(id) })
      toast.success('Đã cập nhật')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Cập nhật thất bại')
    },
  })
}

export function useDeleteBrandMonitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => brandMonitorService.deleteMonitor(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandMonitorKeys.all })
      toast.success('Đã xoá brand monitor')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Xoá thất bại')
    },
  })
}

export function usePollBrandMonitorNow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => brandMonitorService.pollNow(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: brandMonitorKeys.all })
      toast.success('Đã trigger poll')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Poll thất bại')
    },
  })
}
