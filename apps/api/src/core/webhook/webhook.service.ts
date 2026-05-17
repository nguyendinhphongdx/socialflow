import { createHmac } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'
import type { AccountPlatform } from '@prisma/client'
import { AppException, constantTimeEqual, ResponseCode } from '@sociflow/common'
import { APP_CONFIG, type AppConfig } from '../../config'
import { SocialAccountService } from '../social-account/social-account.service'
import { CommentService } from '../comment/comment.service'
import type { IngestCommentInput } from '../comment/comment.repository'
import type {
  FacebookChange,
  FacebookWebhookPayload,
  InstagramWebhookPayload,
  TikTokWebhookPayload,
} from './dto'

/**
 * Webhook business handler. Controller verify signature + parse DTO,
 * service nhận payload đã typed.
 *
 * Idempotency: FB/IG payload không có top-level event id duy nhất —
 * dedupe ở mức từng change (comment_id, post_id). Comment ingest đã
 * có unique constraint `(platform, platformCommentId)` chống duplicate.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name)

  constructor(
    private readonly accountService: SocialAccountService,
    private readonly commentService: CommentService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Verify Meta `x-hub-signature-256` header. Throw AppException nếu fail.
   * Dùng cho cả Facebook + Instagram (cùng app secret).
   */
  verifyMetaSignature(signature: string | undefined, rawBody: Buffer | undefined): void {
    if (!signature) {
      throw new AppException(ResponseCode.AccessDenied, { reason: 'missing_signature' })
    }
    if (!rawBody) {
      throw new AppException(ResponseCode.InternalError, { reason: 'raw_body_not_available' })
    }
    const expected = `sha256=${createHmac('sha256', this.config.oauth.facebook.clientSecret)
      .update(rawBody)
      .digest('hex')}`
    if (!constantTimeEqual(signature, expected)) {
      throw new AppException(ResponseCode.AccessDenied, { reason: 'invalid_signature' })
    }
  }

  /**
   * Verify Meta GET subscribe challenge. Trả `challenge` nếu OK, throw nếu fail.
   */
  verifyMetaSubscribe(mode: string, token: string, challenge: string): string {
    const expected = this.config.webhook.facebookVerifyToken
    if (mode === 'subscribe' && constantTimeEqual(token, expected)) {
      return challenge
    }
    throw new AppException(ResponseCode.AccessDenied, { reason: 'fb_verify_token_mismatch' })
  }

  async handleFacebook(payload: FacebookWebhookPayload): Promise<void> {
    const platform: AccountPlatform = payload.object === 'instagram' ? 'INSTAGRAM' : 'FACEBOOK'
    for (const entry of payload.entry) {
      const pageOrIgId = entry.id
      if (!pageOrIgId) continue

      const account = await this.accountService.findByPlatformUid(platform, pageOrIgId)
      if (!account) {
        this.logger.warn(`No SocialAccount cho ${platform} uid=${pageOrIgId} — bỏ qua`)
        continue
      }

      const changes = entry.changes ?? []
      for (const change of changes) {
        await this.handleChange(account.id, account.userId, platform, change)
      }
    }
  }

  async handleInstagram(payload: InstagramWebhookPayload): Promise<void> {
    // IG payload là FB payload với object=instagram. Reuse handler.
    await this.handleFacebook(payload as unknown as FacebookWebhookPayload)
  }

  async handleTikTok(payload: TikTokWebhookPayload): Promise<void> {
    // Phase tiếp: dispatch theo `event` type (publish.complete / publish.failed)
    // sang PublishService.markPublished / markRejected. Hiện ack + log.
    this.logger.log(
      `TikTok webhook: event=${payload.event} user=${payload.user_openid} create_time=${payload.create_time}`,
    )
  }

  private async handleChange(
    accountId: string,
    userId: string,
    platform: AccountPlatform,
    change: FacebookChange,
  ): Promise<void> {
    const value = change.value
    if (!value) return
    const verb = value.verb

    // Chỉ ingest item=comment, verb=add (mới). Edit/remove handle ở phase sau.
    const isComment = value.item === 'comment' || change.field === 'comments'
    if (!isComment) return
    if (verb && verb !== 'add') {
      this.logger.debug(`Skip ${platform} comment ${value.comment_id} verb=${verb}`)
      return
    }

    const commentId = value.comment_id
    const text = value.message
    if (!commentId || !text) {
      this.logger.warn(`Missing commentId/text in ${platform} webhook payload`)
      return
    }

    const input: IngestCommentInput = {
      userId,
      accountId,
      publishRecordId: null,
      platform,
      platformCommentId: commentId,
      parentCommentId: value.parent_id ?? null,
      authorId: value.from?.id ?? 'unknown',
      authorName: value.from?.name ?? 'Unknown',
      text,
      platformCreatedAt: value.created_time
        ? new Date(value.created_time * 1000)
        : new Date(),
    }

    await this.commentService.ingestPlatformComment(input)
  }
}
