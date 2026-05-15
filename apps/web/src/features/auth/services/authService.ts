import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type { AuthResult, AuthUser, LoginInput, RegisterInput } from '../types'

export const authService = {
  login: async (input: LoginInput): Promise<AuthResult> => {
    const { data } = await apiClient.post<ApiResponse<AuthResult>>('/auth/login', input)
    return data.data
  },
  register: async (input: RegisterInput): Promise<AuthResult> => {
    const { data } = await apiClient.post<ApiResponse<AuthResult>>('/auth/register', input)
    return data.data
  },
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout')
  },
  getMe: async (): Promise<AuthUser> => {
    const { data } = await apiClient.get<ApiResponse<AuthUser>>('/users/me')
    return data.data
  },
}
