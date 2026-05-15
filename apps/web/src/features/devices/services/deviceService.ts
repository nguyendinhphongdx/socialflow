import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type { Agent, AgentListResponse, ListAgentsQuery, PairInitResponse } from '../types'

export const deviceService = {
  list: async (query?: ListAgentsQuery): Promise<AgentListResponse> => {
    const { data } = await apiClient.get<ApiResponse<AgentListResponse>>('/agents', { params: query })
    return data.data
  },
  getById: async (id: string): Promise<Agent> => {
    const { data } = await apiClient.get<ApiResponse<Agent>>(`/agents/${id}`)
    return data.data
  },
  initPair: async (): Promise<PairInitResponse> => {
    const { data } = await apiClient.post<ApiResponse<PairInitResponse>>('/agents/pair/init')
    return data.data
  },
  revoke: async (id: string): Promise<void> => {
    await apiClient.post(`/agents/${id}/revoke`)
  },
}
