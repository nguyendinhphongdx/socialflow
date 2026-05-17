import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'
import type {
  BulkActionInput,
  BulkActionResult,
  BulkReplyInput,
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
  bulkReply: async (input: BulkReplyInput): Promise<BulkActionResult> => {
    const { data } = await apiClient.post<ApiResponse<BulkActionResult>>('/comments/bulk/reply', input)
    return data.data
  },
  bulkMarkReplied: async (input: BulkActionInput): Promise<BulkActionResult> => {
    const { data } = await apiClient.post<ApiResponse<BulkActionResult>>('/comments/bulk/mark-replied', input)
    return data.data
  },
  bulkArchive: async (input: BulkActionInput): Promise<BulkActionResult> => {
    const { data } = await apiClient.post<ApiResponse<BulkActionResult>>('/comments/bulk/archive', input)
    return data.data
  },
  bulkDelete: async (input: BulkActionInput): Promise<BulkActionResult> => {
    const { data } = await apiClient.post<ApiResponse<BulkActionResult>>('/comments/bulk/delete', input)
    return data.data
  },
}
