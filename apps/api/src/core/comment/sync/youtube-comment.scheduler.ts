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
 * Cron mỗi 15 phút cho YouTube. YT có Activity API push notification
 * nhưng không reliable cho comment — vẫn dùng poll cho consistency với TT.
 *
 * Same logic như TikTokCommentScheduler — chỉ filter platform=YOUTUBE.
 */
@Injectable()
export class YouTubeCommentScheduler {
  private readonly logger = new Logger(YouTubeCommentScheduler.name)

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.COMMENT_SYNC) private readonly queue: Queue<CommentSyncJob>,
  ) {}

  @Cron('*/15 * * * *', { name: 'youtube-comment-sync-scan' })
  async scan(): Promise<void> {
    const accounts = await this.prisma.socialAccount.findMany({
      where: {
        platform: 'YOUTUBE',
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
          jobId: `yt-comment-sync-${a.id}-${cycle}`,
        },
      })),
    )
    this.logger.log(`Enqueued ${accounts.length} YouTube comment-sync jobs (cycle ${cycle})`)
  }
}
