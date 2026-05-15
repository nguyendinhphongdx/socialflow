import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { AppException, ResponseCode } from '@sociflow/common'
import { InsightService } from './insight.service'
import { SocialAccountService } from '../social-account/social-account.service'
import type { InsightSnapshotJob } from './insight.scheduler'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'

@Processor(QUEUE_NAMES.INSIGHT_SNAPSHOT, { concurrency: 3 })
export class InsightConsumer extends WorkerHost {
  private readonly logger = new Logger(InsightConsumer.name)

  constructor(
    private readonly insight: InsightService,
    private readonly accountService: SocialAccountService,
  ) {
    super()
  }

  async process(job: Job<InsightSnapshotJob>): Promise<void> {
    switch (job.data.type) {
      case 'post-snapshot':
        return this.processPostSnapshot(job.data.publishRecordId)
      case 'account-rollup':
        return this.processAccountRollup(job.data.accountId, new Date(job.data.dateIso))
      default: {
        const exhaustive: never = job.data
        throw new Error(`Unknown insight job type: ${JSON.stringify(exhaustive)}`)
      }
    }
  }

  private async processPostSnapshot(publishRecordId: string): Promise<void> {
    try {
      await this.insight.snapshotPostInsight(publishRecordId)
    }
    catch (err) {
      await this.handleProviderError(err, { kind: 'post-snapshot', publishRecordId })
    }
  }

  private async processAccountRollup(accountId: string, date: Date): Promise<void> {
    try {
      await this.insight.rollupAccountDailyInsight(accountId, date)
    }
    catch (err) {
      await this.handleProviderError(err, { kind: 'account-rollup', accountId, dateIso: date.toISOString() })
    }
  }

  private async handleProviderError(err: unknown, ctx: Record<string, string>): Promise<void> {
    if (err instanceof AppException) {
      if (err.code === ResponseCode.AccountTokenExpired) {
        const accountId = (err.data as { accountId?: string } | undefined)?.accountId ?? ctx.accountId
        if (accountId) {
          await this.accountService.markTokenExpired(accountId).catch(() => undefined)
        }
        this.logger.warn(`Insight skip — token expired ctx=${JSON.stringify(ctx)}`)
        return
      }
      if (err.code === ResponseCode.InsightFetchFailed) {
        this.logger.warn(`Insight fetch failed ${JSON.stringify({ ctx, data: err.data })}`)
        return
      }
      this.logger.warn(`Insight skip — AppException code=${err.code} ctx=${JSON.stringify(ctx)}`)
      return
    }
    this.logger.error(`Insight job unexpected error ctx=${JSON.stringify(ctx)}`, err as Error)
    throw err
  }
}
