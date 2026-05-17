'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { billingService } from '../services/billing.service'

export const creditKeys = {
  all: ['credits'] as const,
  balance: () => [...creditKeys.all, 'balance'] as const,
  history: (page: number, pageSize: number) => [...creditKeys.all, 'history', page, pageSize] as const,
}

export function useCreditBalance() {
  return useQuery({
    queryKey: creditKeys.balance(),
    queryFn: billingService.getBalance,
    staleTime: 30_000,
    retry: false,
  })
}

export function useCreditHistory(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: creditKeys.history(page, pageSize),
    queryFn: () => billingService.getHistory({ page, pageSize }),
    retry: false,
  })
}

export function useCancelSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: billingService.cancelSubscription,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: creditKeys.all })
      toast.success('Đã hủy gói đăng ký')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Hủy đăng ký thất bại')
    },
  })
}
