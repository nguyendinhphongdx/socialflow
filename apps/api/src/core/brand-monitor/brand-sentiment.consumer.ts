import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { AiClientService } from '@sociflow/internal-client'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'
import { BrandMentionRepository } from './brand-mention.repository'
import { BRAND_SENTIMENT_JOB_NAME, type BrandSentimentJob } from './brand-monitor.constants'

/**
 * Consumer cho BRAND_SENTIMENT queue.
 *
 * Mỗi job:
 *  1. Load mention. Skip nếu đã có sentiment (idempotent — replay safe).
 *  2. Call apps/ai `/internal/ai/sentiment`.
 *  3. Persist sentiment + score qua repository.
 *
 * Error AI provider → throw → BullMQ retry theo defaultJobOptions (3x exp backoff).
 */
@Processor(QUEUE_NAMES.BRAND_SENTIMENT, { concurrency: 3 })
export class BrandSentimentConsumer extends WorkerHost {
  private readonly logger = new Logger(BrandSentimentConsumer.name)

  constructor(
    private readonly mentionRepo: BrandMentionRepository,
    private readonly aiClient: AiClientService,
  ) {
    super()
  }

  async process(job: Job<BrandSentimentJob>): Promise<void> {
    if (job.name !== BRAND_SENTIMENT_JOB_NAME) return

    const { mentionId, text, languageCode } = job.data
    const mention = await this.mentionRepo.getById(mentionId)
    if (!mention) {
      this.logger.warn(`Mention ${mentionId} not found — skip sentiment classify`)
      return
    }
    if (mention.sentiment) {
      this.logger.debug(`Mention ${mentionId} đã có sentiment=${mention.sentiment} — skip`)
      return
    }

    const result = await this.aiClient.classifySentiment({
      text,
      languageCode: languageCode ?? 'vi',
    })

    await this.mentionRepo.updateSentiment(mentionId, result.sentiment, result.score)
    this.logger.log(
      `Classified mention ${mentionId} → ${result.sentiment} (${result.score.toFixed(2)}) via ${result.model}`,
    )
  }
}
