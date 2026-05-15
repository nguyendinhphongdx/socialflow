import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { AccountPlatform, Comment } from '@prisma/client'
import { AppException, ResponseCode, type PaginationDto } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { SocialAccountService } from '../social-account/social-account.service'
import { SocialAccountRepository } from '../social-account/social-account.repository'
import type { CommentReplyPort } from '../auto-reply/auto-reply.constants'
import {
  CommentRepository,
  type CommentListFilter,
  type IngestCommentInput,
} from './comment.repository'
import { CommentProviderRegistry } from './providers/comment-provider.registry'
import {
  COMMENT_NEW_EVENT,
  COMMENT_REPLIED_EVENT,
  type CommentNewEventPayload,
  type CommentRepliedEventPayload,
} from './comment.events'

/**
 * CommentService — orchestrate sync (ingest) + inbox CRUD + manual reply.
 *
 * Implements `CommentReplyPort` để auto-reply consumer gọi (delayed job).
 * AutoReply consumer chỉ biết interface — không circular import vì port
 * chỉ là string symbol + interface từ auto-reply.constants.
 */
@Injectable()
export class CommentService implements CommentReplyPort {
  private readonly logger = new Logger(CommentService.name)

  constructor(
    private readonly repo: CommentRepository,
    private readonly accountRepo: SocialAccountRepository,
    private readonly accountService: SocialAccountService,
    private readonly providers: CommentProviderRegistry,
    private readonly ctx: RequestContextService,
    private readonly events: EventEmitter2,
  ) {}

  async listByCurrentUser(pagination: PaginationDto, filter?: CommentListFilter) {
    const userId = this.ctx.requireUserId()
    return this.repo.listByUserWithPagination(userId, pagination, filter)
  }

  async getByCurrentUserAndId(id: string): Promise<Comment> {
    const userId = this.ctx.requireUserId()
    const comment = await this.repo.getByIdAndUserId(id, userId)
    if (!comment) throw new AppException(ResponseCode.CommentNotFound, { commentId: id })
    return comment
  }

  /**
   * Ingest 1 comment từ platform — entry-point chung cho:
   *  - FB/IG webhook handler (WebhookService)
   *  - TT/YT poll scheduler
   *  - CommentSyncConsumer (background batch)
   *
   * Idempotent: upsert theo (accountId, platformCommentId). Emit `comment.new`
   * **chỉ khi insert lần đầu** để tránh re-trigger auto-reply.
   */
  async ingestPlatformComment(input: IngestCommentInput): Promise<Comment> {
    const { comment, isNew } = await this.repo.upsertByPlatformId(input)

    if (isNew) {
      const payload: CommentNewEventPayload = {
        commentId: comment.id,
        userId: comment.userId,
        accountId: comment.accountId,
        platform: comment.platform,
      }
      this.events.emit(COMMENT_NEW_EVENT, payload)
      this.logger.log(
        `Ingested new comment ${comment.id} (${comment.platform}/${comment.platformCommentId}) → emit comment.new`,
      )
    }
    return comment
  }

  async markAsRead(id: string): Promise<Comment> {
    const comment = await this.getByCurrentUserAndId(id)
    // 'read' map sang REPLIED nếu đã reply, else NEW vẫn giữ — UI dùng cờ riêng.
    // Hiện không có UNREAD/READ state riêng → no-op để tránh đè status.
    return comment
  }

  async markAsIgnored(id: string): Promise<Comment> {
    const comment = await this.getByCurrentUserAndId(id)
    if (comment.status === 'REPLIED') {
      throw new AppException(ResponseCode.EngagementInvalidComment, {
        reason: 'cannot_ignore_replied_comment',
      })
    }
    return this.repo.updateStatusById(comment.id, 'IGNORED')
  }

  async markAsSpam(id: string): Promise<Comment> {
    const comment = await this.getByCurrentUserAndId(id)
    return this.repo.updateStatusById(comment.id, 'SPAM')
  }

  async applyMarkAction(id: string, action: 'read' | 'ignore' | 'spam'): Promise<Comment> {
    if (action === 'read') return this.markAsRead(id)
    if (action === 'ignore') return this.markAsIgnored(id)
    return this.markAsSpam(id)
  }

  /**
   * Reply manual từ controller. User ownership check qua `getByCurrentUserAndId`.
   *
   * Steps:
   *  1. Load comment + account
   *  2. Decrypt accessToken
   *  3. Call platform provider.reply(...)
   *  4. Mark comment REPLIED + emit `comment.replied`
   */
  async replyManualFromCurrentUser(id: string, text: string): Promise<Comment> {
    const userId = this.ctx.requireUserId()
    const comment = await this.repo.getByIdAndUserId(id, userId)
    if (!comment) throw new AppException(ResponseCode.CommentNotFound, { commentId: id })
    return this.doReply(comment, text, userId)
  }

  /**
   * Port implementation cho AutoReplyConsumer.
   * Caller pass userId từ job payload (no CLS context trong worker).
   */
  async replyManually(
    commentId: string,
    text: string,
    userId: string,
    ruleId: string,
  ): Promise<{ platformReplyId?: string }> {
    const comment = await this.repo.getByIdAndUserId(commentId, userId)
    if (!comment) throw new AppException(ResponseCode.CommentNotFound, { commentId })
    const replied = await this.doReply(comment, text, userId, ruleId)
    return { platformReplyId: replied.replyPlatformId ?? undefined }
  }

  async softDelete(id: string): Promise<void> {
    const comment = await this.getByCurrentUserAndId(id)
    await this.repo.softDeleteById(comment.id)
  }

  // ---- helpers ----

  private async doReply(
    comment: Comment,
    text: string,
    userId: string,
    autoReplyRuleId?: string,
  ): Promise<Comment> {
    if (comment.status === 'DELETED' || comment.status === 'HIDDEN') {
      throw new AppException(ResponseCode.EngagementInvalidComment, {
        commentId: comment.id,
        status: comment.status,
      })
    }
    const account = await this.accountRepo.getById(comment.accountId)
    if (!account || account.userId !== userId) {
      throw new AppException(ResponseCode.AccountNotFound, { accountId: comment.accountId })
    }
    if (account.status !== 'ACTIVE') {
      throw new AppException(ResponseCode.AccountTokenExpired, { accountId: account.id })
    }

    const provider = this.providers.get(account.platform)
    const decryptedToken = this.accountService.decryptAccessToken(account)
    const result = await provider.reply({
      account,
      decryptedAccessToken: decryptedToken,
      parentCommentId: comment.platformCommentId,
      text,
    })

    const updated = await this.repo.markRepliedById(
      comment.id,
      text,
      result.replyPlatformId,
      autoReplyRuleId,
    )

    const payload: CommentRepliedEventPayload = {
      commentId: updated.id,
      userId: updated.userId,
      accountId: updated.accountId,
      platform: updated.platform,
      replyText: text,
      replyPlatformId: result.replyPlatformId,
      autoReplyRuleId,
    }
    this.events.emit(COMMENT_REPLIED_EVENT, payload)
    this.logger.log(
      `Replied comment ${updated.id} on ${updated.platform} → ${result.replyPlatformId}`,
    )
    return updated
  }

  /**
   * Worker-friendly variant cho sync consumer / scheduler (no CLS).
   *
   * Batch ingest — gọi upsert tuần tự. Mỗi insert mới → emit `comment.new`
   * với Sociflow commentId. Không Promise.all để tránh quá tải Prisma pool.
   */
  async ingestBatch(
    platform: AccountPlatform,
    inputs: IngestCommentInput[],
  ): Promise<{ inserted: number, updated: number }> {
    let inserted = 0
    let updated = 0
    for (const input of inputs) {
      const { comment, isNew } = await this.repo.upsertByPlatformId(input)
      if (isNew) {
        const payload: CommentNewEventPayload = {
          commentId: comment.id,
          userId: comment.userId,
          accountId: comment.accountId,
          platform: comment.platform,
        }
        this.events.emit(COMMENT_NEW_EVENT, payload)
        inserted += 1
      }
      else {
        updated += 1
      }
    }
    this.logger.log(`Ingest batch ${platform}: ${inserted} new, ${updated} updated`)
    return { inserted, updated }
  }
}
