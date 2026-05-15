import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type { CreatePublishInput, ListPublishQuery, PublishRecord } from '../types'

export interface PublishListResponse {
  list: PublishRecord[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export const publishService = {
  create: async (input: CreatePublishInput): Promise<PublishListResponse> => {
    const { data } = await apiClient.post<ApiResponse<PublishListResponse>>('/publish', input)
    return data.data
  },
  list: async (query?: ListPublishQuery): Promise<PublishListResponse> => {
    const { data } = await apiClient.get<ApiResponse<PublishListResponse>>('/publish', { params: query })
    return data.data
  },
  getById: async (id: string): Promise<PublishRecord> => {
    const { data } = await apiClient.get<ApiResponse<PublishRecord>>(`/publish/${id}`)
    return data.data
  },
  cancel: async (id: string): Promise<void> => {
    await apiClient.delete(`/publish/${id}`)
  },
}
