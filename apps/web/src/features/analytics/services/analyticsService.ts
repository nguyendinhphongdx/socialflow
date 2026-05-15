import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type { AccountTimelineResponse, PostInsight } from '../types'

export const analyticsService = {
  listPostInsights: async (publishRecordId: string): Promise<PostInsight[]> => {
    const { data } = await apiClient.get<ApiResponse<PostInsight[]>>(`/insights/posts/${publishRecordId}`)
    return data.data
  },
  getLatestPostInsight: async (publishRecordId: string): Promise<PostInsight> => {
    const { data } = await apiClient.get<ApiResponse<PostInsight>>(`/insights/posts/${publishRecordId}/latest`)
    return data.data
  },
  snapshotPostNow: async (publishRecordId: string): Promise<PostInsight> => {
    const { data } = await apiClient.post<ApiResponse<PostInsight>>(`/insights/posts/${publishRecordId}/snapshot-now`)
    return data.data
  },
  getAccountTimeline: async (accountId: string, days: number): Promise<AccountTimelineResponse> => {
    const { data } = await apiClient.get<ApiResponse<AccountTimelineResponse>>(
      `/insights/accounts/${accountId}/timeline`,
      { params: { days } },
    )
    return data.data
  },
}
