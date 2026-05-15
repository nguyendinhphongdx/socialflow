import type { AccountPlatform, SocialAccount } from '@prisma/client'

/**
 * Context truyền vào reply provider. Caller (CommentService) phải decrypt
 * accessToken trước khi gọi — provider không tự decrypt.
 */
export interface CommentReplyContext {
  account: SocialAccount
  decryptedAccessToken: string
  /** Comment cha cần reply (platform-native ID, không phải Sociflow ID) */
  parentCommentId: string
  text: string
}

export interface CommentReplyResult {
  replyPlatformId: string
}

/**
 * Mỗi platform implement interface này để reply comment.
 *
 * Throw `AppException(ResponseCode.CommentReplyFailed)` cho hard fail
 * (sai schema, content rejected). Throw `RetryableError` cho transient.
 */
export interface CommentReplyProvider {
  readonly platform: AccountPlatform
  reply(ctx: CommentReplyContext): Promise<CommentReplyResult>
}
