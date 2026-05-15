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
 * Reply comment trên Facebook Page.
 * Endpoint: POST {comment-id}/comments { message, access_token }
 * Response: { id }
 */
@Injectable()
export class FacebookCommentProvider implements CommentReplyProvider {
  readonly platform = 'FACEBOOK' as const
  private readonly logger = new Logger(FacebookCommentProvider.name)

  async reply(ctx: CommentReplyContext): Promise<CommentReplyResult> {
    try {
      const response = await axios.post<{ id?: string }>(
        `${GRAPH}/${ctx.parentCommentId}/comments`,
        new URLSearchParams({
          message: ctx.text,
          access_token: ctx.decryptedAccessToken,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      )
      const id = response.data.id
      if (!id) {
        throw new AppException(ResponseCode.CommentReplyFailed, {
          provider: 'facebook',
          details: response.data,
        })
      }
      this.logger.log(`FB reply success on ${ctx.parentCommentId} → ${id}`)
      return { replyPlatformId: id }
    }
    catch (err) {
      this.mapError(err)
    }
  }

  private mapError(err: unknown): never {
    const status = (err as { response?: { status?: number } }).response?.status
    const data = (err as { response?: { data?: { error?: { code?: number, message?: string } } } }).response?.data
    const fbError = data?.error

    if (fbError?.code === 190 || status === 401) {
      throw new AppException(ResponseCode.AccountTokenExpired, { provider: 'facebook', fbError })
    }
    if (status && status >= 500) {
      throw new RetryableError(`FB comment reply ${status}: ${fbError?.message}`)
    }
    if (err instanceof AppException) throw err
    throw new AppException(ResponseCode.CommentReplyFailed, { provider: 'facebook', fbError, details: data })
  }
}
