import { Injectable, Logger } from '@nestjs/common'
import type { AccountInsight, PostInsight, Prisma, PublishRecord, SocialAccount } from '@prisma/client'
import { AppException, ResponseCode } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { PublishService } from '../publish/publish.service'
import { SocialAccountService } from '../social-account/social-account.service'
import { PostInsightRepository } from './post-insight.repository'
import { AccountInsightRepository } from './account-insight.repository'
import { InsightProviderRegistry } from './insight-provider.registry'

export interface AccountTimelinePoint {
  date: Date
  followers: number
  followersDelta: number
  totalPosts: number
  totalEngagement: number
  reach: number
}

@Injectable()
export class InsightService {
  private readonly logger = new Logger(InsightService.name)

  constructor(
    private readonly postRepo: PostInsightRepository,
    private readonly accountInsightRepo: AccountInsightRepository,
    private readonly publishService: PublishService,
    private readonly accountService: SocialAccountService,
    private readonly registry: InsightProviderRegistry,
    private readonly ctx: RequestContextService,
  ) {}

  /**
   * List snapshot của 1 publish record cho user hiện tại — kiểm tra ownership.
   */
  async listPostSnapshotsByCurrentUser(publishRecordId: string): Promise<PostInsight[]> {
    await this.assertPublishRecordOwnership(publishRecordId)
    return this.postRepo.listByPublishRecordId(publishRecordId)
  }

  async latestPostSnapshotByCurrentUser(publishRecordId: string): Promise<PostInsight> {
    await this.assertPublishRecordOwnership(publishRecordId)
    const latest = await this.postRepo.latestByPublishRecordId(publishRecordId)
    if (!latest) throw new AppException(ResponseCode.InsightNotFound, { publishRecordId })
    return latest
  }

  /**
   * Timeline N ngày cho 1 account của user — kiểm tra ownership.
   */
  async listAccountTimelineByCurrentUser(accountId: string, days: number): Promise<AccountTimelinePoint[]> {
    const userId = this.ctx.requireUserId()
    const account = await this.accountService.getByIdAndUserId(accountId, userId)
    if (!account) throw new AppException(ResponseCode.AccountNotFound, { accountId })

    const toDate = startOfUtcDay(new Date())
    const fromDate = new Date(toDate.getTime() - days * 86_400_000)
    const rows = await this.accountInsightRepo.listByAccountIdInRange(accountId, fromDate, toDate)
    return rows.map(r => ({
      date: r.date,
      followers: r.followers,
      followersDelta: r.followersDelta,
      totalPosts: r.totalPosts,
      totalEngagement: r.totalEngagement,
      reach: r.reach,
    }))
  }

  /**
   * Manual trigger snapshot — kiểm tra ownership + chạy ngay.
   */
  async snapshotPostByCurrentUser(publishRecordId: string): Promise<PostInsight> {
    await this.assertPublishRecordOwnership(publishRecordId)
    return this.snapshotPostInsight(publishRecordId)
  }

  /**
   * Core: snapshot 1 publish record → tạo PostInsight row mới.
   * Dùng từ consumer (queue) hoặc service-internal khi user manual trigger.
   */
  async snapshotPostInsight(publishRecordId: string): Promise<PostInsight> {
    const record = await this.publishService.getById(publishRecordId)
    if (!record) {
      throw new AppException(ResponseCode.PublishTaskNotFound, { publishRecordId })
    }
    if (record.status !== 'PUBLISHED' || !record.platformPostId) {
      throw new AppException(ResponseCode.InsightFetchFailed, {
        reason: 'record_not_published',
        publishRecordId,
        status: record.status,
      })
    }
    const account = await this.accountService.getById(record.accountId)
    if (!account) throw new AppException(ResponseCode.AccountNotFound, { accountId: record.accountId })

    const provider = this.registry.get(account.platform)
    const token = this.accountService.decryptAccessToken(account)
    const metrics = await provider.fetchPostMetrics(account, token, record.platformPostId)

    return this.postRepo.create({
      publishRecord: { connect: { id: record.id } },
      views: metrics.views,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      saves: metrics.saves,
      reachUnique: metrics.reachUnique,
      raw: metrics.raw as Prisma.InputJsonValue,
    })
  }

  /**
   * Rollup daily metric cho 1 account: tổng hợp PostInsight của các record published
   * trong day + lấy followers count hiện tại từ provider.
   */
  async rollupAccountDailyInsight(accountId: string, date: Date): Promise<AccountInsight> {
    const account = await this.accountService.getById(accountId)
    if (!account) throw new AppException(ResponseCode.AccountNotFound, { accountId })

    const dayStart = startOfUtcDay(date)
    const dayEnd = new Date(dayStart.getTime() + 86_400_000 - 1)

    const records = await this.publishService.listPublishedByAccountInRange(accountId, dayStart, dayEnd)
    const recordIds = records.map(r => r.id)
    const totals = await this.aggregateLatestForRecords(recordIds)

    const followers = await this.tryFetchFollowers(account)
    const previous = await this.accountInsightRepo.getLatestByAccountId(accountId)
    const followersDelta = previous ? followers - previous.followers : 0

    return this.accountInsightRepo.upsertByAccountAndDate(accountId, dayStart, {
      followers,
      followersDelta,
      totalPosts: records.length,
      totalEngagement: totals.totalEngagement,
      reach: totals.reach,
      raw: { recordIds } as Prisma.InputJsonValue,
    })
  }

  private async aggregateLatestForRecords(recordIds: string[]): Promise<{ totalEngagement: number, reach: number }> {
    let totalEngagement = 0
    let reach = 0
    for (const recordId of recordIds) {
      const latest = await this.postRepo.latestByPublishRecordId(recordId)
      if (!latest) continue
      totalEngagement += latest.likes + latest.comments + latest.shares + latest.saves
      reach += latest.reachUnique
    }
    return { totalEngagement, reach }
  }

  private async tryFetchFollowers(account: SocialAccount): Promise<number> {
    try {
      const provider = this.registry.get(account.platform)
      const token = this.accountService.decryptAccessToken(account)
      return await provider.fetchAccountFollowers(account, token)
    }
    catch (err) {
      if (err instanceof AppException && err.code === ResponseCode.InsightFetchFailed) {
        this.logger.warn(`Followers fetch failed for ${account.id} (${account.platform}) — fallback 0`)
        const previous = await this.accountInsightRepo.getLatestByAccountId(account.id)
        return previous?.followers ?? 0
      }
      throw err
    }
  }

  /**
   * Backfill historical: tìm published records trong [daysBack, recentCutoffDays] ngày trước
   * mà chưa có PostInsight nào → trả về list recordIds để scheduler enqueue.
   *
   * `recentCutoffDays`: tránh overlap với cron 6h (đã handle records mới <2 ngày)
   * `limit`: tránh burst rate-limit; scheduler chạy weekly nên 500/lần đủ.
   */
  async findRecordsMissingInsights(
    daysBack: number,
    recentCutoffDays: number,
    limit: number,
  ): Promise<PublishRecord[]> {
    const now = Date.now()
    const fromDate = new Date(now - daysBack * 86_400_000)
    const toDate = new Date(now - recentCutoffDays * 86_400_000)

    // Pull window rộng rồi filter những record chưa có insight.
    // Lookup 1 query với inverse exists pattern: 2x batch để bù record đã có insight bị skip.
    const candidates = await this.publishService.listRecentPublishedWithPlatformPostId(fromDate, limit * 2)
    const missing: PublishRecord[] = []
    for (const record of candidates) {
      if (missing.length >= limit) break
      if (record.publishedAt && record.publishedAt > toDate) continue
      const existing = await this.postRepo.latestByPublishRecordId(record.id)
      if (!existing) missing.push(record)
    }
    this.logger.log(`Backfill scan: ${candidates.length} candidates → ${missing.length} missing insight`)
    return missing
  }

  private async assertPublishRecordOwnership(publishRecordId: string): Promise<void> {
    const userId = this.ctx.requireUserId()
    const record = await this.publishService.getByIdAndUserId(publishRecordId, userId)
    if (!record) throw new AppException(ResponseCode.PublishTaskNotFound, { publishRecordId })
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0))
}
