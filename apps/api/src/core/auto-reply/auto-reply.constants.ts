/**
 * Constants riêng cho AutoReply module.
 *
 * Event name `comment.new` được emit từ CommentService khi sync 1 comment mới.
 * Payload: { commentId, userId, accountId, platform }.
 *
 * Job name `auto-reply` được enqueue với delay = rule.replyDelaySec * 1000 (ms).
 * Payload: AutoReplyJob.
 */
import type { AccountPlatform } from '@prisma/client'

export const COMMENT_NEW_EVENT = 'comment.new'

export const AUTO_REPLY_JOB_NAME = 'auto-reply'

export const COMMENT_REPLY_PORT = Symbol('COMMENT_REPLY_PORT')

/**
 * Payload event `comment.new`. CommentService emit khi sync comment mới
 * (qua webhook FB/IG hoặc poll TT/YT).
 */
export interface CommentNewEvent {
  commentId: string
  userId: string
  accountId: string
  platform: AccountPlatform
}

/**
 * Job payload đẩy vào queue AUTO_REPLY. Consumer đọc và gọi CommentReplyPort.
 */
export interface AutoReplyJob {
  commentId: string
  ruleId: string
  renderedText: string
  userId: string
}

/**
 * Port abstraction để Consumer gọi CommentService.replyManually mà không
 * tạo circular import. CommentModule khi implement sẽ provide token này.
 *
 * Trả về platform reply ID (nếu có) để Consumer cập nhật Comment.replyPlatformId.
 */
export interface CommentReplyPort {
  replyManually(commentId: string, text: string, userId: string, ruleId: string): Promise<{ platformReplyId?: string }>
}
