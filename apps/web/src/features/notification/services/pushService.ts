import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type {
  PushSubscriptionListVo,
  PushSubscriptionPayload,
  PushSubscriptionVo,
} from '../types'

export const pushService = {
  subscribe: async (payload: PushSubscriptionPayload): Promise<PushSubscriptionVo> => {
    const { data } = await apiClient.post<ApiResponse<PushSubscriptionVo>>(
      '/notifications/push/subscribe',
      payload,
    )
    return data.data
  },
  list: async (): Promise<PushSubscriptionListVo> => {
    const { data } = await apiClient.get<ApiResponse<PushSubscriptionListVo>>(
      '/notifications/push',
    )
    return data.data
  },
  unsubscribe: async (id: string): Promise<void> => {
    await apiClient.delete(`/notifications/push/${id}`)
  },
}
