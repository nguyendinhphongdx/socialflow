import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { PrismaService } from '@sociflow/prisma'
import { QUEUE_NAMES } from '../../../libs/queue/queue.module'
import {
  COMMENT_SYNC_JOB_NAME,
  type CommentSyncJob,
} from './comment-sync.types'

const BATCH_SIZE = 200

/**
 * Cron mỗi 15 phút quét tất cả TikTok account ACTIVE → enqueue 1 job/account
 * vào COMMENT_SYNC queue. Consumer (CommentSyncConsumer) sẽ fetch comments.
 *
 * Lý do quét tách scheduler/consumer:
 *  - Scheduler lightweight (1 query Prisma + addBulk)
 *  - Consumer concurrency-limited tránh đánh sập API TikTok
 *  - Job ID dedupe trong cùng cycle để không double-poll
 */
@Injectable()
export class TikTokCommentScheduler {
  private readonly logger = new Logger(TikTokCommentScheduler.name)

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.COMMENT_SYNC) private readonly queue: Queue<CommentSyncJob>,
  ) {}

  @Cron('*/15 * * * *', { name: 'tiktok-comment-sync-scan' })
  async scan(): Promise<void> {
    const accounts = await this.prisma.socialAccount.findMany({
      where: {
        platform: 'TIKTOK',
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true },
      take: BATCH_SIZE,
    })
    if (accounts.length === 0) return

    const cycle = Math.floor(Date.now() / (15 * 60 * 1000))
    await this.queue.addBulk(
      accounts.map(a => ({
        name: COMMENT_SYNC_JOB_NAME,
        data: { accountId: a.id } satisfies CommentSyncJob,
        opts: {
          jobId: `tt-comment-sync-${a.id}-${cycle}`,
        },
      })),
    )
    this.logger.log(`Enqueued ${accounts.length} TikTok comment-sync jobs (cycle ${cycle})`)
  }
}
