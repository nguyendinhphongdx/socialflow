import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { CreditsService } from './credits.service'
import { type CreditsPurchaseJob } from './credits.constants'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'

/**
 * Consumer cho CREDITS_PURCHASE queue.
 *
 * Producer: WebhookController khi nhận Stripe `checkout.session.completed`
 * hoặc `invoice.payment_succeeded`.
 *
 * Flow:
 *  1. Idempotency check (CreditsService.grant ném null nếu stripeEventId trùng).
 *  2. Grant credit qua atomic ledger transaction.
 *  3. Throw → BullMQ retry với exponential backoff (5 attempts, delay 10s).
 *
 * KHÔNG return job result (Stripe không cần).
 */
@Processor(QUEUE_NAMES.CREDITS_PURCHASE, { concurrency: 3 })
export class CreditsPurchaseConsumer extends WorkerHost {
  private readonly logger = new Logger(CreditsPurchaseConsumer.name)

  constructor(private readonly credits: CreditsService) {
    super()
  }

  async process(job: Job<CreditsPurchaseJob>): Promise<void> {
    const data = job.data
    const result = await this.credits.grant({
      userId: data.userId,
      amount: data.amount,
      type: 'PURCHASE',
      reason: data.reason,
      stripeEventId: data.stripeEventId,
      stripeInvoiceId: data.stripeInvoiceId,
      metadata: (data.metadata as object | undefined) ?? undefined,
    })
    if (!result) {
      this.logger.warn(`Purchase job ${job.id} idempotent skip (event ${data.stripeEventId})`)
      return
    }
    this.logger.log(
      `Granted ${data.amount} credits to user ${data.userId} via Stripe event ${data.stripeEventId}`,
    )
  }
}
