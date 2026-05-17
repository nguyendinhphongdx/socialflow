import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { Queue } from 'bullmq'
import type { AccountPlatform, BrandMention, BrandMonitor } from '@prisma/client'
import { AppException, ResponseCode, type Paginated, type PaginationDto } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'
import { BrandMonitorRepository } from './brand-monitor.repository'
import { BrandMentionRepository, type ListBrandMentionFilter } from './brand-mention.repository'
import type { CreateBrandMonitorDto, UpdateBrandMonitorDto } from './brand-monitor.dto'
import {
  BRAND_MENTION_DETECTED_EVENT,
  BRAND_SENTIMENT_JOB_NAME,
  type BrandMentionDetectedEvent,
  type BrandSentimentJob,
} from './brand-monitor.constants'

interface PlatformMatchResult {
  platform: AccountPlatform
  matches: number
  warning?: string
}

export interface PollResult {
  monitorId: string
  polledAt: Date
  totalMatches: number
  perPlatform: Record<string, number>
  warnings: string[]
}

export interface RecordMentionInput {
  monitorId: string
  platform: AccountPlatform
  platformPostId?: string | null
  authorName?: string | null
  authorPlatformId?: string | null
  text: string
  permalink?: string | null
  postedAt?: Date | null
  matchedKeywords: string[]
}

@Injectable()
export class BrandMonitorService {
  private readonly logger = new Logger(BrandMonitorService.name)

  constructor(
    private readonly repo: BrandMonitorRepository,
    private readonly mentionRepo: BrandMentionRepository,
    private readonly ctx: RequestContextService,
    private readonly events: EventEmitter2,
    @InjectQueue(QUEUE_NAMES.BRAND_SENTIMENT) private readonly sentimentQueue: Queue<BrandSentimentJob>,
  ) {}

  // ---- BrandMonitor CRUD ----

  async listByCurrentUser(pagination: PaginationDto, filter?: { enabled?: boolean }) {
    const userId = this.ctx.requireUserId()
    return this.repo.listByUserWithPagination(userId, pagination, filter)
  }

  async getByCurrentUserAndId(id: string): Promise<BrandMonitor> {
    const userId = this.ctx.requireUserId()
    const entity = await this.repo.getByIdAndUserId(id, userId)
    if (!entity) throw new AppException(ResponseCode.BrandMonitorNotFound, { monitorId: id })
    return entity
  }

  async create(dto: CreateBrandMonitorDto): Promise<BrandMonitor> {
    const userId = this.ctx.requireUserId()
    return this.repo.create({
      user: { connect: { id: userId } },
      name: dto.name,
      query: dto.query,
      platforms: dto.platforms,
      enabled: dto.enabled,
      pollIntervalMin: dto.pollIntervalMin,
    })
  }

  async update(id: string, dto: UpdateBrandMonitorDto): Promise<BrandMonitor> {
    const existing = await this.getByCurrentUserAndId(id)
    return this.repo.updateById(existing.id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.query !== undefined && { query: dto.query }),
      ...(dto.platforms !== undefined && { platforms: dto.platforms }),
      ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      ...(dto.pollIntervalMin !== undefined && { pollIntervalMin: dto.pollIntervalMin }),
    })
  }

  async softDelete(id: string): Promise<void> {
    const entity = await this.getByCurrentUserAndId(id)
    await this.repo.softDeleteById(entity.id)
  }

  // ---- Poll ----

  /**
   * Manual trigger từ controller — kiểm tra ownership trước.
   */
  async pollByCurrentUser(id: string): Promise<PollResult> {
    const monitor = await this.getByCurrentUserAndId(id)
    return this.pollMonitor(monitor)
  }

  /**
   * Cron entrypoint: list monitor due now → poll từng cái.
   * Lỗi 1 monitor không stop loop.
   */
  async pollAll(): Promise<{ polled: number, totalMatches: number }> {
    const due = await this.repo.listDuePollNow(new Date())
    if (due.length === 0) return { polled: 0, totalMatches: 0 }

    let totalMatches = 0
    for (const monitor of due) {
      try {
        const result = await this.pollMonitor(monitor)
        totalMatches += result.totalMatches
      }
      catch (err) {
        this.logger.error(`Poll monitor ${monitor.id} failed`, err as Error)
      }
    }
    this.logger.log(`pollAll polled=${due.length} matches=${totalMatches}`)
    return { polled: due.length, totalMatches }
  }

  /**
   * Poll core: chạy search cho từng platform → aggregate match count.
   * Phase 6: search API là stub (TT/IG cần app review, FB Graph search deprecated).
   * Khi provider trả mentions thật → call `recordMention` để persist + enqueue sentiment.
   */
  private async pollMonitor(monitor: BrandMonitor): Promise<PollResult> {
    const polledAt = new Date()
    const results: PlatformMatchResult[] = []

    for (const platform of monitor.platforms) {
      const res = await this.searchPlatform(platform, monitor.query)
      results.push(res)
    }

    const totalMatches = results.reduce((sum, r) => sum + r.matches, 0)
    const perPlatform: Record<string, number> = {}
    const warnings: string[] = []
    for (const r of results) {
      perPlatform[r.platform] = r.matches
      if (r.warning) warnings.push(`${r.platform}: ${r.warning}`)
    }

    await this.repo.setLastPolled(monitor.id, polledAt)
    if (totalMatches > 0) await this.repo.incrementMatchCount(monitor.id, totalMatches)

    this.logger.log(`Polled monitor ${monitor.id} → ${totalMatches} matches (${warnings.length} warn)`)

    return {
      monitorId: monitor.id,
      polledAt,
      totalMatches,
      perPlatform,
      warnings,
    }
  }

  /**
   * Stub search per platform. Real implementation cần API key + app review:
   *  - YOUTUBE: Search.list (quota-heavy, 100 unit / req)
   *  - FACEBOOK: Graph search deprecated từ 2018
   *  - INSTAGRAM: Graph hashtag-search yêu cầu app review
   *  - TIKTOK: Research API yêu cầu approval
   *
   * Khi switch sang provider thật, mỗi raw post match → gọi `recordMention`.
   */
  private async searchPlatform(platform: AccountPlatform, _query: string): Promise<PlatformMatchResult> {
    return {
      platform,
      matches: 0,
      warning: 'search_api_not_implemented_phase_6',
    }
  }

  // ---- Mention persist + sentiment ----

  /**
   * Persist 1 mention idempotent + enqueue sentiment job.
   *
   * Idempotency: unique `(monitorId, platform, platformPostId)`. Replay job
   * an toàn — không double-count, không double-classify (consumer cũng skip
   * khi sentiment đã set).
   *
   * Emit `brand.mention.detected` chỉ khi insert lần đầu (`isNew`).
   */
  async recordMention(input: RecordMentionInput): Promise<BrandMention> {
    const monitor = await this.repo.getById(input.monitorId)
    if (!monitor || monitor.deletedAt) {
      throw new AppException(ResponseCode.BrandMonitorNotFound, { monitorId: input.monitorId })
    }

    const { mention, isNew } = await this.mentionRepo.upsertByPlatformPostId({
      userId: monitor.userId,
      monitorId: monitor.id,
      platform: input.platform,
      platformPostId: input.platformPostId,
      authorName: input.authorName,
      authorPlatformId: input.authorPlatformId,
      text: input.text,
      permalink: input.permalink,
      postedAt: input.postedAt,
      matchedKeywords: input.matchedKeywords,
    })

    if (isNew) {
      const payload: BrandMentionDetectedEvent = {
        mentionId: mention.id,
        monitorId: monitor.id,
        userId: monitor.userId,
        text: mention.text,
        platform: input.platform,
      }
      this.events.emit(BRAND_MENTION_DETECTED_EVENT, payload)

      if (!mention.sentiment) {
        await this.sentimentQueue.add(
          BRAND_SENTIMENT_JOB_NAME,
          { mentionId: mention.id, text: mention.text },
          { jobId: `sentiment-${mention.id}` },
        )
      }
      this.logger.log(
        `Recorded mention ${mention.id} for monitor ${monitor.id} on ${input.platform} → sentiment job queued`,
      )
    }

    return mention
  }

  // ---- Mention queries ----

  async listMentionsByCurrentUser(
    pagination: PaginationDto,
    filter?: ListBrandMentionFilter,
  ): Promise<Paginated<BrandMention>> {
    const userId = this.ctx.requireUserId()
    if (filter?.monitorId) {
      // Verify ownership của monitor trước khi list
      await this.getByCurrentUserAndId(filter.monitorId)
    }
    return this.mentionRepo.listByUserWithPagination(userId, pagination, filter)
  }

  async getMentionByCurrentUserAndId(id: string): Promise<BrandMention> {
    const userId = this.ctx.requireUserId()
    const mention = await this.mentionRepo.getByIdAndUserId(id, userId)
    if (!mention) throw new AppException(ResponseCode.BrandMentionNotFound, { mentionId: id })
    return mention
  }

  async ackMention(id: string): Promise<BrandMention> {
    const mention = await this.getMentionByCurrentUserAndId(id)
    return this.mentionRepo.updateStatusById(mention.id, 'ACKED')
  }

  async archiveMention(id: string): Promise<BrandMention> {
    const mention = await this.getMentionByCurrentUserAndId(id)
    return this.mentionRepo.updateStatusById(mention.id, 'ARCHIVED')
  }
}
