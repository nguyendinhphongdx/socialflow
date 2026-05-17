import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type {
  AiCredential,
  AiCredentialInput,
  AiProvider,
  AiProviderStatus,
  VerifyResult,
} from '../types'

export const aiCredentialService = {
  list: async (): Promise<AiCredential[]> => {
    const { data } = await apiClient.get<ApiResponse<{ list: AiCredential[] }>>(
      '/ai-credentials',
    )
    return data.data.list
  },

  status: async (provider?: AiProvider): Promise<AiProviderStatus[]> => {
    const { data } = await apiClient.get<ApiResponse<{ rows: AiProviderStatus[] }>>(
      '/ai-credentials/status',
      { params: provider ? { provider } : undefined },
    )
    return data.data.rows
  },

  upsert: async (input: AiCredentialInput): Promise<AiCredential> => {
    const { data } = await apiClient.post<ApiResponse<AiCredential>>(
      '/ai-credentials',
      input,
    )
    return data.data
  },

  verify: async (id: string): Promise<VerifyResult> => {
    const { data } = await apiClient.post<ApiResponse<VerifyResult>>(
      `/ai-credentials/${id}/verify`,
    )
    return data.data
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/ai-credentials/${id}`)
  },
}
