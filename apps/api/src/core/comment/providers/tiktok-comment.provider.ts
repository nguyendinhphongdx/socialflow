import { Injectable } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import type {
  CommentReplyContext,
  CommentReplyProvider,
  CommentReplyResult,
} from './comment-provider.interface'

/**
 * TikTok Comment API hiện chưa public cho reply (chỉ có Display API
 * read-only). Khi user cần reply TT comment → phải qua AUTOMATION mode
 * (browser extension) — không qua provider này.
 *
 * Provider tồn tại để registry không trống cho platform=TIKTOK.
 */
@Injectable()
export class TikTokCommentProvider implements CommentReplyProvider {
  readonly platform = 'TIKTOK' as const

  async reply(_ctx: CommentReplyContext): Promise<CommentReplyResult> {
    throw new AppException(ResponseCode.CommentReplyFailed, {
      provider: 'tiktok',
      reason: 'tiktok_reply_not_supported_via_api',
      hint: 'TikTok yêu cầu AUTOMATION mode qua browser extension cho reply',
    })
  }
}
