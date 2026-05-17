import { apiClient } from '@/lib/api/client'
import type { InviteMemberInput, Workspace, WorkspaceMember } from '../types'

interface ApiEnvelope<T> {
  data: T
  code: number
  message: string
  timestamp: number
}

export const workspaceService = {
  async list(): Promise<Workspace[]> {
    const res = await apiClient.get<ApiEnvelope<{ list: Workspace[] }>>('/workspaces')
    return res.data.data.list
  },

  async getCurrent(): Promise<Workspace> {
    const res = await apiClient.get<ApiEnvelope<Workspace>>('/workspaces/current')
    return res.data.data
  },

  async create(name: string): Promise<Workspace> {
    const res = await apiClient.post<ApiEnvelope<Workspace>>('/workspaces', { name })
    return res.data.data
  },

  async listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const res = await apiClient.get<ApiEnvelope<{ list: WorkspaceMember[] }>>(
      `/workspaces/${workspaceId}/members`,
    )
    return res.data.data.list
  },

  async inviteMember(workspaceId: string, input: InviteMemberInput): Promise<WorkspaceMember> {
    const res = await apiClient.post<ApiEnvelope<WorkspaceMember>>(
      `/workspaces/${workspaceId}/invite`,
      input,
    )
    return res.data.data
  },

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await apiClient.delete(`/workspaces/${workspaceId}/members/${userId}`)
  },

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: InviteMemberInput['role'],
  ): Promise<WorkspaceMember> {
    const res = await apiClient.patch<ApiEnvelope<WorkspaceMember>>(
      `/workspaces/${workspaceId}/members/${userId}/role`,
      { role },
    )
    return res.data.data
  },
}
