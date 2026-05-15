import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type {
  Comment,
  CommentListResponse,
  ListCommentsQuery,
  MarkCommentInput,
  ReplyCommentInput,
} from '../types'

export const inboxService = {
  list: async (query?: ListCommentsQuery): Promise<CommentListResponse> => {
    const { data } = await apiClient.get<ApiResponse<CommentListResponse>>('/comments', { params: query })
    return data.data
  },
  getById: async (id: string): Promise<Comment> => {
    const { data } = await apiClient.get<ApiResponse<Comment>>(`/comments/${id}`)
    return data.data
  },
  reply: async (id: string, input: ReplyCommentInput): Promise<Comment> => {
    const { data } = await apiClient.post<ApiResponse<Comment>>(`/comments/${id}/reply`, input)
    return data.data
  },
  mark: async (id: string, input: MarkCommentInput): Promise<Comment> => {
    const { data } = await apiClient.post<ApiResponse<Comment>>(`/comments/${id}/mark`, input)
    return data.data
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/comments/${id}`)
  },
}
