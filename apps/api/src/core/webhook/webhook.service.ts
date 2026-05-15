import { Injectable, Logger } from '@nestjs/common'
import type { AccountPlatform } from '@prisma/client'
import { SocialAccountRepository } from '../social-account/social-account.repository'
import { CommentService } from '../comment/comment.service'
import type { IngestCommentInput } from '../comment/comment.repository'

/**
 * Meta webhook payload (FB + IG share schema):
 *
 * {
 *   object: 'page' | 'instagram',
 *   entry: [{
 *     id: <pageId | igUserId>,
 *     time: <unix>,
 *     changes: [{
 *       field: 'feed' | 'comments' | 'mention',
 *       value: { item: 'comment', verb: 'add' | 'edited' | 'remove', ... }
 *     }]
 *   }]
 * }
 *
 * Tài liệu ref: https://developers.facebook.com/docs/graph-api/webhooks/reference/page
 */
interface FbChangeValue {
  item?: string
  verb?: string
  comment_id?: string
  post_id?: string
  parent_id?: string
  message?: string
  created_time?: number
  from?: { id?: string, name?: string }
  // IG-specific
  id?: string
  text?: string
  media?: { id?: string }
}

interface FbWebhookPayload {
  object?: 'page' | 'instagram'
  entry?: Array<{
    id?: string
    time?: number
    changes?: Array<{ field?: string, value?: FbChangeValue }>
  }>
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name)

  constructor(
    private readonly accountRepo: SocialAccountRepository,
    private readonly commentService: CommentService,
  ) {}

  /**
   * Phase 6 Facebook page webhook: feed/comments dispatch.
   * Mỗi entry.id = pageId → tra cứu SocialAccount → ingest comment.
   */
  async handleFacebook(body: unknown): Promise<void> {
    const payload = body as FbWebhookPayload
    const platform: AccountPlatform = payload.object === 'instagram' ? 'INSTAGRAM' : 'FACEBOOK'
    const entries = payload.entry ?? []

    for (const entry of entries) {
      const pageOrIgId = entry.id
      if (!pageOrIgId) continue

      const account = await this.accountRepo.findByPlatformUid(platform, pageOrIgId)
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

  private async handleChange(
    accountId: string,
    userId: string,
    platform: AccountPlatform,
    change: { field?: string, value?: FbChangeValue },
  ): Promise<void> {
    const value = change.value
    if (!value) return
    const verb = value.verb

    // Chỉ ingest item=comment, verb=add (mới). Edit/remove sẽ handle ở phase sau.
    const isComment = value.item === 'comment' || change.field === 'comments'
    if (!isComment) return
    if (verb && verb !== 'add') {
      this.logger.debug(`Skip ${platform} comment ${value.comment_id ?? value.id} verb=${verb}`)
      return
    }

    const commentId = value.comment_id ?? value.id
    const text = value.message ?? value.text ?? ''
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
