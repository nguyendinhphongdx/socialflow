import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type {
  AutoReplyRule,
  AutoReplyRuleListResponse,
  CreateAutoReplyRuleInput,
  ListRulesQuery,
  UpdateAutoReplyRuleInput,
} from '../types'

export const autoReplyService = {
  list: async (query?: ListRulesQuery): Promise<AutoReplyRuleListResponse> => {
    const { data } = await apiClient.get<ApiResponse<AutoReplyRuleListResponse>>('/auto-reply-rules', { params: query })
    return data.data
  },
  getById: async (id: string): Promise<AutoReplyRule> => {
    const { data } = await apiClient.get<ApiResponse<AutoReplyRule>>(`/auto-reply-rules/${id}`)
    return data.data
  },
  create: async (input: CreateAutoReplyRuleInput): Promise<AutoReplyRule> => {
    const { data } = await apiClient.post<ApiResponse<AutoReplyRule>>('/auto-reply-rules', input)
    return data.data
  },
  update: async (id: string, input: UpdateAutoReplyRuleInput): Promise<AutoReplyRule> => {
    const { data } = await apiClient.patch<ApiResponse<AutoReplyRule>>(`/auto-reply-rules/${id}`, input)
    return data.data
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/auto-reply-rules/${id}`)
  },
  toggle: async (id: string): Promise<AutoReplyRule> => {
    const { data } = await apiClient.post<ApiResponse<AutoReplyRule>>(`/auto-reply-rules/${id}/toggle`)
    return data.data
  },
}
