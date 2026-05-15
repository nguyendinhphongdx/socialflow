import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { OnEvent } from '@nestjs/event-emitter'
import type { Queue } from 'bullmq'
import type { AutoReplyRule } from '@prisma/client'
import { AutoReplyRuleRepository } from './auto-reply-rule.repository'
import { AutoReplyRuleService } from './auto-reply-rule.service'
import { AutoReplyCommentRepository, type CommentForMatching } from './auto-reply-comment.repository'
import {
  AUTO_REPLY_JOB_NAME,
  COMMENT_NEW_EVENT,
  type AutoReplyJob,
  type CommentNewEvent,
} from './auto-reply.constants'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'

/**
 * Lắng `comment.new` event → match rules → enqueue delayed reply job.
 *
 * Flow:
 *  1. Load comment (text, platform, account, authorName, post title)
 *  2. Lấy enabled rules (filtered by user + platform + account)
 *  3. Match in-memory qua AutoReplyRuleService.matchRules
 *  4. Mỗi rule match:
 *     a. incrementMatchCount (luôn — kể cả khi không reply do quota)
 *     b. Atomic reset quota nếu cần (lastResetAt < startOfToday)
 *     c. Skip nếu repliesToday >= maxRepliesPerDay
 *     d. Render template → enqueue job với delay = rule.replyDelaySec * 1000
 */
@Injectable()
export class AutoReplyProcessor {
  private readonly logger = new Logger(AutoReplyProcessor.name)

  constructor(
    private readonly ruleRepo: AutoReplyRuleRepository,
    private readonly ruleService: AutoReplyRuleService,
    private readonly commentRepo: AutoReplyCommentRepository,
    @InjectQueue(QUEUE_NAMES.AUTO_REPLY) private readonly queue: Queue<AutoReplyJob>,
  ) {}

  @OnEvent(COMMENT_NEW_EVENT, { async: true })
  async handleCommentNew(event: CommentNewEvent): Promise<void> {
    const comment = await this.commentRepo.getForMatching(event.commentId)
    if (!comment) {
      this.logger.warn(`Comment ${event.commentId} not found — skip auto-reply`)
      return
    }

    const candidates = await this.ruleRepo.listEnabledForMatching(
      event.userId,
      event.platform,
      event.accountId,
    )
    if (candidates.length === 0) return

    const matched = this.ruleService.matchRules(comment, candidates)
    if (matched.length === 0) return

    for (const rule of matched) {
      await this.processMatchedRule(rule, comment, event.userId)
    }
  }

  private async processMatchedRule(
    rule: AutoReplyRule,
    comment: CommentForMatching,
    userId: string,
  ): Promise<void> {
    await this.ruleRepo.incrementMatchCount(rule.id)

    // Reset quota nếu sang ngày mới (atomic via WHERE guard).
    await this.ruleRepo.resetDailyQuotaIfNeeded(rule.id, new Date())

    // Re-fetch để có quota fresh sau reset (1 round-trip nhỏ — chấp nhận được).
    const fresh = await this.ruleRepo.getById(rule.id)
    if (!fresh) return
    if (fresh.repliesToday >= fresh.maxRepliesPerDay) {
      this.logger.warn(
        `Rule ${rule.id} skip — quota exceeded ${fresh.repliesToday}/${fresh.maxRepliesPerDay}`,
      )
      return
    }

    const renderedText = this.renderTemplate(fresh.replyTemplate, comment)
    const delayMs = fresh.replyDelaySec * 1000

    await this.queue.add(
      AUTO_REPLY_JOB_NAME,
      {
        commentId: comment.id,
        ruleId: fresh.id,
        renderedText,
        userId,
      },
      { delay: delayMs },
    )
    this.logger.log(
      `Enqueued auto-reply for comment ${comment.id} rule ${fresh.id} delay ${delayMs}ms`,
    )
  }

  /**
   * Render template — replace placeholder.
   *
   * Supported variables:
   *  - {{authorName}}  → comment.authorName
   *  - {{postTitle}}   → publishRecord.title (fallback '')
   *
   * Future: handlebars / mustache với conditional. Hiện đủ cho keyword reply.
   */
  private renderTemplate(template: string, comment: CommentForMatching): string {
    return template
      .replaceAll('{{authorName}}', comment.authorName)
      .replaceAll('{{postTitle}}', comment.publishRecordTitle ?? '')
  }
}
