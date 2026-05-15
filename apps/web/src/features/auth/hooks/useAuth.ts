'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { authService } from '../services/authService'
import { resetSession } from '@/lib/api/client'
import type { LoginInput, RegisterInput } from '../types'

export const authKeys = {
  me: ['auth', 'me'] as const,
}

export function useAuth() {
  const { data, isLoading, error } = useQuery({
    queryKey: authKeys.me,
    queryFn: authService.getMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
  return {
    user: data ?? null,
    isLoading,
    isAuthenticated: !!data,
    error,
  }
}

export function useLogin() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    onSuccess: (result) => {
      qc.setQueryData(authKeys.me, result.user)
      router.push('/dashboard')
      toast.success('Đăng nhập thành công')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Đăng nhập thất bại')
    },
  })
}

export function useRegister() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (input: RegisterInput) => authService.register(input),
    onSuccess: (result) => {
      qc.setQueryData(authKeys.me, result.user)
      router.push('/dashboard')
      toast.success('Đăng ký thành công')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Đăng ký thất bại')
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      qc.clear()
      resetSession()
      router.push('/login')
    },
  })
}
