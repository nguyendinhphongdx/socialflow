import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type {
  CreateDraftInput,
  Draft,
  DraftListResponse,
  DraftPublishResult,
  ListDraftQuery,
  PublishDraftInput,
  UpdateDraftInput,
} from '../types'

export const draftService = {
  list: async (query?: ListDraftQuery): Promise<DraftListResponse> => {
    const { data } = await apiClient.get<ApiResponse<DraftListResponse>>('/drafts', { params: query })
    return data.data
  },
  getById: async (id: string): Promise<Draft> => {
    const { data } = await apiClient.get<ApiResponse<Draft>>(`/drafts/${id}`)
    return data.data
  },
  create: async (input: CreateDraftInput): Promise<Draft> => {
    const { data } = await apiClient.post<ApiResponse<Draft>>('/drafts', input)
    return data.data
  },
  update: async (id: string, input: UpdateDraftInput): Promise<Draft> => {
    const { data } = await apiClient.patch<ApiResponse<Draft>>(`/drafts/${id}`, input)
    return data.data
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/drafts/${id}`)
  },
  publish: async (id: string, input: PublishDraftInput): Promise<DraftPublishResult[]> => {
    const { data } = await apiClient.post<ApiResponse<DraftPublishResult[]>>(`/drafts/${id}/publish`, input)
    return data.data
  },
}
