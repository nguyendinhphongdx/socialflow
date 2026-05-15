import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { AppException, ResponseCode, RetryableError } from '@sociflow/common'
import type {
  CommentReplyContext,
  CommentReplyProvider,
  CommentReplyResult,
} from './comment-provider.interface'

const COMMENTS_URL = 'https://www.googleapis.com/youtube/v3/comments?part=snippet'

/**
 * Reply YouTube comment thread.
 *
 * POST /youtube/v3/comments?part=snippet
 * Body: { snippet: { parentId, textOriginal } }
 *
 * `parentId` là top-level commentThread ID. Reply tới reply
 * (nested) sẽ flatten về cùng parent — đây là quirk của YT API.
 */
@Injectable()
export class YouTubeCommentProvider implements CommentReplyProvider {
  readonly platform = 'YOUTUBE' as const
  private readonly logger = new Logger(YouTubeCommentProvider.name)

  async reply(ctx: CommentReplyContext): Promise<CommentReplyResult> {
    try {
      const response = await axios.post<{ id?: string }>(
        COMMENTS_URL,
        {
          snippet: {
            parentId: ctx.parentCommentId,
            textOriginal: ctx.text,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${ctx.decryptedAccessToken}`,
            'Content-Type': 'application/json',
          },
        },
      )
      const id = response.data.id
      if (!id) {
        throw new AppException(ResponseCode.CommentReplyFailed, {
          provider: 'youtube',
          details: response.data,
        })
      }
      this.logger.log(`YT reply success on ${ctx.parentCommentId} → ${id}`)
      return { replyPlatformId: id }
    }
    catch (err) {
      this.mapError(err)
    }
  }

  private mapError(err: unknown): never {
    const status = (err as { response?: { status?: number } }).response?.status
    const data = (err as { response?: { data?: unknown } }).response?.data

    if (status === 401 || status === 403) {
      throw new AppException(ResponseCode.AccountTokenExpired, { provider: 'youtube' })
    }
    if (status && status >= 500) {
      throw new RetryableError(`YT comment reply ${status}`)
    }
    if (err instanceof AppException) throw err
    throw new AppException(ResponseCode.CommentReplyFailed, { provider: 'youtube', details: data })
  }
}
