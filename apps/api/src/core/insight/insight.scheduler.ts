import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { PublishService } from '../publish/publish.service'
import { SocialAccountService } from '../social-account/social-account.service'
import { InsightService } from './insight.service'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'

const RECENT_PUBLISH_LOOKBACK_DAYS = 30
const SNAPSHOT_BATCH_SIZE = 500
const BACKFILL_LOOKBACK_DAYS = 30
const BACKFILL_RECENT_CUTOFF_DAYS = 7
const BACKFILL_BATCH_SIZE = 500

export type InsightSnapshotJob =
  | { type: 'post-snapshot', publishRecordId: string }
  | { type: 'account-rollup', accountId: string, dateIso: string }

/**
 * Insight scheduler — 2 cron:
 * - Mỗi 6h: snapshot tất cả PUBLISHED record trong 30 ngày gần nhất.
 * - 1 AM UTC daily: rollup AccountInsight cho ngày hôm qua.
 *
 * Cả 2 cron đều enqueue jobs vào INSIGHT_SNAPSHOT queue → consumer process song song.
 */
@Injectable()
export class InsightScheduler {
  private readonly logger = new Logger(InsightScheduler.name)

  constructor(
    private readonly publishService: PublishService,
    private readonly accountService: SocialAccountService,
    private readonly insightService: InsightService,
    @InjectQueue(QUEUE_NAMES.INSIGHT_SNAPSHOT) private readonly queue: Queue<InsightSnapshotJob>,
  ) {}

  @Cron('0 */6 * * *', { name: 'insight-post-snapshot' })
  async snapshotRecentPosts(): Promise<void> {
    const since = new Date(Date.now() - RECENT_PUBLISH_LOOKBACK_DAYS * 86_400_000)
    const records = await this.publishService.listRecentPublishedWithPlatformPostId(since, SNAPSHOT_BATCH_SIZE)
    if (records.length === 0) return

    await this.queue.addBulk(
      records.map(r => ({
        name: 'post-snapshot',
        data: { type: 'post-snapshot', publishRecordId: r.id } satisfies InsightSnapshotJob,
        opts: { jobId: `snapshot-${r.id}-${Date.now()}` },
      })),
    )
    this.logger.log(`Enqueued ${records.length} post snapshot jobs`)
  }

  /**
   * Weekly Sunday 4 AM UTC — backfill 7-30 ngày qua cho record chưa có insight.
   * - Cron 6h chỉ snapshot record `publishedAt >= now-30d` nhưng có thể skip nếu
   *   provider fail tạm thời (token expired, rate limit).
   * - Backfill scan records [7-30d) chưa có PostInsight → enqueue lại.
   * - Limit 500/cycle tránh burst rate-limit (chạy weekly nên đủ).
   */
  @Cron('0 4 * * 0', { name: 'insight-backfill-missing' })
  async backfillMissingInsights(): Promise<void> {
    const missing = await this.insightService.findRecordsMissingInsights(
      BACKFILL_LOOKBACK_DAYS,
      BACKFILL_RECENT_CUTOFF_DAYS,
      BACKFILL_BATCH_SIZE,
    )
    if (missing.length === 0) {
      this.logger.log('Backfill: no missing insight records')
      return
    }
    await this.queue.addBulk(
      missing.map(r => ({
        name: 'post-snapshot',
        data: { type: 'post-snapshot', publishRecordId: r.id } satisfies InsightSnapshotJob,
        opts: { jobId: `backfill-${r.id}-${Date.now()}` },
      })),
    )
    this.logger.log(`Backfill: enqueued ${missing.length} snapshot jobs`)
  }

  @Cron('0 1 * * *', { name: 'insight-account-rollup' })
  async rollupAccountsForYesterday(): Promise<void> {
    const yesterday = startOfUtcDay(new Date(Date.now() - 86_400_000))
    const accounts = await this.accountService.listActiveApiAccounts(SNAPSHOT_BATCH_SIZE)
    if (accounts.length === 0) return

    await this.queue.addBulk(
      accounts.map(a => ({
        name: 'account-rollup',
        data: {
          type: 'account-rollup',
          accountId: a.id,
          dateIso: yesterday.toISOString(),
        } satisfies InsightSnapshotJob,
        opts: { jobId: `rollup-${a.id}-${yesterday.getTime()}` },
      })),
    )
    this.logger.log(`Enqueued ${accounts.length} account rollup jobs cho ${yesterday.toISOString()}`)
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0))
}
