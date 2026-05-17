import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { CreditsService } from './credits.service'
import { type CreditsRefundJob } from './credits.constants'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'

/**
 * Consumer cho CREDITS_REFUND queue.
 *
 * Producer: WebhookController khi nhận Stripe `charge.refunded`.
 *
 * Revoke credit user (negative amount) — idempotent qua stripeEventId.
 * Lưu ý: nếu user.aiCredits đã consume hết, balance có thể âm sau refund.
 * Chấp nhận âm (ledger là source of truth — không hard-block).
 */
@Processor(QUEUE_NAMES.CREDITS_REFUND, { concurrency: 3 })
export class CreditsRefundConsumer extends WorkerHost {
  private readonly logger = new Logger(CreditsRefundConsumer.name)

  constructor(private readonly credits: CreditsService) {
    super()
  }

  async process(job: Job<CreditsRefundJob>): Promise<void> {
    const data = job.data
    const result = await this.credits.refund({
      userId: data.userId,
      amount: data.amount,
      reason: data.reason,
      stripeEventId: data.stripeEventId,
      metadata: (data.metadata as object | undefined) ?? { chargeId: data.stripeChargeId },
    })
    if (!result) {
      this.logger.warn(`Refund job ${job.id} idempotent skip (event ${data.stripeEventId})`)
      return
    }
    this.logger.log(
      `Revoked ${data.amount} credits from user ${data.userId} via Stripe event ${data.stripeEventId}`,
    )
  }
}
