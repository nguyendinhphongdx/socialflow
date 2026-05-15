/**
 * Event constants + payload types cho Comment domain.
 *
 * `comment.new` được emit từ CommentService.ingestPlatformComment khi sync 1
 * comment lần đầu (insert). AutoReplyProcessor (auto-reply.module) subscribe
 * qua `@OnEvent('comment.new')`.
 *
 * Lưu ý: re-export `COMMENT_NEW_EVENT` từ auto-reply.constants để tránh
 * trùng lặp string literal. CommentNewEventPayload mirror `CommentNewEvent`.
 */
import type { AccountPlatform } from '@prisma/client'

export const COMMENT_NEW_EVENT = 'comment.new'
export const COMMENT_REPLIED_EVENT = 'comment.replied'

export interface CommentNewEventPayload {
  commentId: string
  userId: string
  accountId: string
  platform: AccountPlatform
}

export interface CommentRepliedEventPayload {
  commentId: string
  userId: string
  accountId: string
  platform: AccountPlatform
  replyText: string
  replyPlatformId?: string
  /** rule trigger reply (undefined = manual reply) */
  autoReplyRuleId?: string
}
