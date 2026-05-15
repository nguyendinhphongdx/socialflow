'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deviceService } from '../services/deviceService'
import type { ListAgentsQuery } from '../types'

export const deviceKeys = {
  all: ['devices'] as const,
  list: (query?: ListAgentsQuery) => [...deviceKeys.all, 'list', query] as const,
  detail: (id: string) => [...deviceKeys.all, 'detail', id] as const,
}

export function useDevices(query?: ListAgentsQuery) {
  return useQuery({
    queryKey: deviceKeys.list(query),
    queryFn: () => deviceService.list(query),
    refetchInterval: 10_000,             // poll online status mỗi 10s
  })
}

export function useInitPair() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => deviceService.initPair(),
    onSuccess: () => qc.invalidateQueries({ queryKey: deviceKeys.all }),
    onError: () => toast.error('Tạo mã pair thất bại'),
  })
}

export function useRevokeDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deviceService.revoke(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deviceKeys.all })
      toast.success('Đã huỷ liên kết thiết bị')
    },
    onError: () => toast.error('Huỷ thiết bị thất bại'),
  })
}
