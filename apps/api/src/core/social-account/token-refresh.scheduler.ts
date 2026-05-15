import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { SocialAccountRepository } from './social-account.repository'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'

const REFRESH_LEAD_MS = 15 * 60 * 1000     // refresh nếu hết hạn trong 15 phút tới
const BATCH_SIZE = 100

interface TokenRefreshJob {
  accountId: string
  platform: string
}

/**
 * Cron mỗi 5 phút: quét tài khoản API có `tokenExpiresAt` sắp hết hạn, enqueue refresh job.
 */
@Injectable()
export class TokenRefreshScheduler {
  private readonly logger = new Logger(TokenRefreshScheduler.name)

  constructor(
    private readonly repo: SocialAccountRepository,
    @InjectQueue(QUEUE_NAMES.TOKEN_REFRESH) private readonly queue: Queue<TokenRefreshJob>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'token-refresh-scan' })
  async scan(): Promise<void> {
    const cutoff = new Date(Date.now() + REFRESH_LEAD_MS)
    const accounts = await this.repo.listExpiringTokens(cutoff, BATCH_SIZE)
    if (accounts.length === 0) return

    this.logger.log(`Found ${accounts.length} accounts with expiring tokens`)
    await this.queue.addBulk(
      accounts.map(a => ({
        name: 'refresh',
        data: { accountId: a.id, platform: a.platform } satisfies TokenRefreshJob,
        opts: {
          jobId: `refresh-${a.id}-${a.tokenExpiresAt?.getTime() ?? 0}`,   // dedupe trong cùng cycle
        },
      })),
    )
  }
}
