import type { AccountPlatform } from '@/features/accounts'

export type CommentStatus = 'NEW' | 'REPLIED' | 'IGNORED' | 'SPAM'

export type CommentMarkAction = 'read' | 'ignore' | 'spam'

export interface Comment {
  id: string
  platform: AccountPlatform
  platformCommentId: string
  authorName: string
  authorAvatarUrl: string | null
  text: string
  mediaUrl: string | null
  likeCount: number
  replyCount: number
  status: CommentStatus
  repliedAt: string | null
  replyText: string | null
  replyPlatformId: string | null
  platformCreatedAt: string
  syncedAt: string
  accountId: string
  publishRecordId: string | null
  parentCommentId: string | null
}

export interface ListCommentsQuery {
  page?: number
  pageSize?: number
  status?: CommentStatus
  accountId?: string
  platform?: AccountPlatform
  hasReply?: boolean
  search?: string
}

export interface CommentListResponse {
  list: Comment[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ReplyCommentInput {
  text: string
}

export interface MarkCommentInput {
  action: CommentMarkAction
}
