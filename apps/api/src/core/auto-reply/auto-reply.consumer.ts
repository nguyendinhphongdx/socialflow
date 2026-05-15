import { Inject, Logger, Optional } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { AppException, ResponseCode } from '@sociflow/common'
import { AutoReplyRuleRepository } from './auto-reply-rule.repository'
import { AutoReplyCommentRepository } from './auto-reply-comment.repository'
import {
  AUTO_REPLY_JOB_NAME,
  COMMENT_REPLY_PORT,
  type AutoReplyJob,
  type CommentReplyPort,
} from './auto-reply.constants'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'

/**
 * Consumer xử lý delayed auto-reply job:
 *  1. Re-check rule còn enabled + quota còn slot (defense-in-depth — qua thời gian delay
 *     user có thể disable rule hoặc rule khác đã reply hết quota).
 *  2. Gọi CommentReplyPort.replyManually (CommentModule provide token này).
 *  3. Trên thành công: incrementReplyCount + mark comment.
 *  4. Trên thất bại: throw → BullMQ retry theo defaultJobOptions.
 */
@Processor(QUEUE_NAMES.AUTO_REPLY, { concurrency: 3 })
export class AutoReplyConsumer extends WorkerHost {
  private readonly logger = new Logger(AutoReplyConsumer.name)

  constructor(
    private readonly ruleRepo: AutoReplyRuleRepository,
    private readonly commentRepo: AutoReplyCommentRepository,
    @Optional() @Inject(COMMENT_REPLY_PORT) private readonly replyPort?: CommentReplyPort,
  ) {
    super()
  }

  async process(job: Job<AutoReplyJob>): Promise<void> {
    const { commentId, ruleId, renderedText, userId } = job.data

    const rule = await this.ruleRepo.getById(ruleId)
    if (!rule || !rule.enabled || rule.deletedAt) {
      this.logger.warn(`Rule ${ruleId} no longer active — skip job for comment ${commentId}`)
      return
    }

    await this.ruleRepo.resetDailyQuotaIfNeeded(ruleId, new Date())
    const fresh = await this.ruleRepo.getById(ruleId)
    if (!fresh) return
    if (fresh.repliesToday >= fresh.maxRepliesPerDay) {
      this.logger.warn(`Rule ${ruleId} quota exhausted at consume time — skip`)
      throw new AppException(ResponseCode.AutoReplyQuotaExceeded, { ruleId })
    }

    if (!this.replyPort) {
      // CommentModule chưa wire — log để dev biết, không retry để khỏi spam queue.
      this.logger.error(
        `CommentReplyPort chưa được provide — không thể reply comment ${commentId}. `
        + `CommentModule cần register provider với token COMMENT_REPLY_PORT.`,
      )
      return
    }

    const result = await this.replyPort.replyManually(commentId, renderedText, userId, ruleId)

    await this.commentRepo.markReplied(commentId, ruleId, renderedText, result.platformReplyId)
    await this.ruleRepo.incrementReplyCount(ruleId)

    this.logger.log(
      `Auto-replied comment ${commentId} via rule ${ruleId}`
      + (result.platformReplyId ? ` (platform reply ${result.platformReplyId})` : ''),
    )
  }
}
