import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type {
  BrandMention,
  BrandMentionListResponse,
  BrandMonitor,
  BrandMonitorListResponse,
  CreateBrandMonitorInput,
  ListBrandMentionQuery,
  ListBrandMonitorQuery,
  UpdateBrandMonitorInput,
} from '../types'

export const brandMonitorService = {
  listMonitors: async (query?: ListBrandMonitorQuery): Promise<BrandMonitorListResponse> => {
    const { data } = await apiClient.get<ApiResponse<BrandMonitorListResponse>>('/brand-monitors', { params: query })
    return data.data
  },
  getMonitor: async (id: string): Promise<BrandMonitor> => {
    const { data } = await apiClient.get<ApiResponse<BrandMonitor>>(`/brand-monitors/${id}`)
    return data.data
  },
  createMonitor: async (input: CreateBrandMonitorInput): Promise<BrandMonitor> => {
    const { data } = await apiClient.post<ApiResponse<BrandMonitor>>('/brand-monitors', input)
    return data.data
  },
  updateMonitor: async (id: string, input: UpdateBrandMonitorInput): Promise<BrandMonitor> => {
    const { data } = await apiClient.patch<ApiResponse<BrandMonitor>>(`/brand-monitors/${id}`, input)
    return data.data
  },
  deleteMonitor: async (id: string): Promise<void> => {
    await apiClient.delete(`/brand-monitors/${id}`)
  },
  pollNow: async (id: string): Promise<void> => {
    await apiClient.post(`/brand-monitors/${id}/poll-now`)
  },
  listMentions: async (query?: ListBrandMentionQuery): Promise<BrandMentionListResponse> => {
    const { data } = await apiClient.get<ApiResponse<BrandMentionListResponse>>('/brand-mentions', { params: query })
    return data.data
  },
  ackMention: async (id: string): Promise<BrandMention> => {
    const { data } = await apiClient.post<ApiResponse<BrandMention>>(`/brand-mentions/${id}/ack`)
    return data.data
  },
  archiveMention: async (id: string): Promise<BrandMention> => {
    const { data } = await apiClient.post<ApiResponse<BrandMention>>(`/brand-mentions/${id}/archive`)
    return data.data
  },
}
