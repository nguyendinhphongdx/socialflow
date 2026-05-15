import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type { ListAccountsQuery, SocialAccount } from '../types'

export interface SocialAccountListResponse {
  list: SocialAccount[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export const accountService = {
  list: async (query?: ListAccountsQuery): Promise<SocialAccountListResponse> => {
    const { data } = await apiClient.get<ApiResponse<SocialAccountListResponse>>('/social-accounts', { params: query })
    return data.data
  },
  getById: async (id: string): Promise<SocialAccount> => {
    const { data } = await apiClient.get<ApiResponse<SocialAccount>>(`/social-accounts/${id}`)
    return data.data
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/social-accounts/${id}`)
  },
}

/**
 * URL bắt đầu OAuth flow connect platform.
 * Browser redirect tới URL này, backend redirect tới provider, callback về `/dashboard/accounts`.
 */
export function connectAccountUrl(platform: 'youtube' | 'facebook' | 'instagram' | 'tiktok', opts?: { returnUrl?: string, groupId?: string }): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'
  const params = new URLSearchParams()
  if (opts?.returnUrl) params.set('returnUrl', opts.returnUrl)
  if (opts?.groupId) params.set('groupId', opts.groupId)
  const qs = params.toString()
  return `${base}/social-accounts/${platform}/authorize${qs ? `?${qs}` : ''}`
}
