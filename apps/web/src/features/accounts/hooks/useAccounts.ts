'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { accountService } from '../services/accountService'
import type { ListAccountsQuery } from '../types'

export const accountKeys = {
  all: ['accounts'] as const,
  list: (query?: ListAccountsQuery) => [...accountKeys.all, 'list', query] as const,
  detail: (id: string) => [...accountKeys.all, 'detail', id] as const,
}

export function useAccounts(query?: ListAccountsQuery) {
  return useQuery({
    queryKey: accountKeys.list(query),
    queryFn: () => accountService.list(query),
  })
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: accountKeys.detail(id),
    queryFn: () => accountService.getById(id),
    enabled: !!id,
  })
}

export function useDisconnectAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => accountService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.all })
      toast.success('Đã ngắt kết nối tài khoản')
    },
    onError: () => toast.error('Ngắt kết nối thất bại'),
  })
}
