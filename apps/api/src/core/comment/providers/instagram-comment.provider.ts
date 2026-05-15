import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { AppException, ResponseCode, RetryableError } from '@sociflow/common'
import type {
  CommentReplyContext,
  CommentReplyProvider,
  CommentReplyResult,
} from './comment-provider.interface'

const GRAPH = 'https://graph.facebook.com/v21.0'

/**
 * Reply comment Instagram Business / Creator.
 * Endpoint: POST {ig-comment-id}/replies { message, access_token }
 *
 * Cùng Meta Graph như Facebook nhưng path khác — IG dùng `/replies`,
 * không phải `/comments`.
 */
@Injectable()
export class InstagramCommentProvider implements CommentReplyProvider {
  readonly platform = 'INSTAGRAM' as const
  private readonly logger = new Logger(InstagramCommentProvider.name)

  async reply(ctx: CommentReplyContext): Promise<CommentReplyResult> {
    try {
      const response = await axios.post<{ id?: string }>(
        `${GRAPH}/${ctx.parentCommentId}/replies`,
        new URLSearchParams({
          message: ctx.text,
          access_token: ctx.decryptedAccessToken,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      )
      const id = response.data.id
      if (!id) {
        throw new AppException(ResponseCode.CommentReplyFailed, {
          provider: 'instagram',
          details: response.data,
        })
      }
      this.logger.log(`IG reply success on ${ctx.parentCommentId} → ${id}`)
      return { replyPlatformId: id }
    }
    catch (err) {
      this.mapError(err)
    }
  }

  private mapError(err: unknown): never {
    const status = (err as { response?: { status?: number } }).response?.status
    const data = (err as { response?: { data?: { error?: { code?: number, message?: string } } } }).response?.data
    const igError = data?.error

    if (igError?.code === 190 || status === 401) {
      throw new AppException(ResponseCode.AccountTokenExpired, { provider: 'instagram', igError })
    }
    if (status && status >= 500) {
      throw new RetryableError(`IG comment reply ${status}: ${igError?.message}`)
    }
    if (err instanceof AppException) throw err
    throw new AppException(ResponseCode.CommentReplyFailed, { provider: 'instagram', igError, details: data })
  }
}
