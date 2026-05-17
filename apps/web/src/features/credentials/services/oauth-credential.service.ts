import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type {
  AccountPlatform,
  OAuthCredential,
  OAuthCredentialInput,
  PlatformStatus,
  VerifyResult,
} from '../types'

export const oauthCredentialService = {
  list: async (): Promise<OAuthCredential[]> => {
    const { data } = await apiClient.get<ApiResponse<{ list: OAuthCredential[] }>>(
      '/oauth-credentials',
    )
    return data.data.list
  },

  status: async (platform?: AccountPlatform): Promise<PlatformStatus[]> => {
    const { data } = await apiClient.get<ApiResponse<{ rows: PlatformStatus[] }>>(
      '/oauth-credentials/status',
      { params: platform ? { platform } : undefined },
    )
    return data.data.rows
  },

  upsert: async (input: OAuthCredentialInput): Promise<OAuthCredential> => {
    const { data } = await apiClient.post<ApiResponse<OAuthCredential>>(
      '/oauth-credentials',
      input,
    )
    return data.data
  },

  verify: async (id: string): Promise<VerifyResult> => {
    const { data } = await apiClient.post<ApiResponse<VerifyResult>>(
      `/oauth-credentials/${id}/verify`,
    )
    return data.data
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/oauth-credentials/${id}`)
  },
}

/**
 * Build redirect URI cho 1 platform — user copy paste vào platform dev console.
 * Backend route: `/api/v1/social-accounts/{platform}/callback`.
 */
export function buildRedirectUri(platform: AccountPlatform): string {
  const appUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'
  const lower = platform.toLowerCase()
  return `${appUrl}/social-accounts/${lower}/callback`
}
