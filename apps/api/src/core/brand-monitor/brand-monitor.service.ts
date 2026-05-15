import { Injectable, Logger } from '@nestjs/common'
import type { AccountPlatform, BrandMonitor } from '@prisma/client'
import { AppException, ResponseCode, type PaginationDto } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { BrandMonitorRepository } from './brand-monitor.repository'
import type { CreateBrandMonitorDto, UpdateBrandMonitorDto } from './brand-monitor.dto'

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

@Injectable()
export class BrandMonitorService {
  private readonly logger = new Logger(BrandMonitorService.name)

  constructor(
    private readonly repo: BrandMonitorRepository,
    private readonly ctx: RequestContextService,
  ) {}

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
   * Phase 6: search API là stub vì TT/IG cần app review, FB Graph search deprecated.
   * Persist matches deferred (cần BrandMention table — Phase 7).
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
   * - YOUTUBE: Search.list (quota-heavy, 100 unit / req)
   * - FACEBOOK: Graph search deprecated từ 2018, chỉ còn search trong page user own
   * - INSTAGRAM: Graph hashtag-search yêu cầu app review + business approval
   * - TIKTOK: Research API yêu cầu academic / business approval
   *
   * Phase 6 return 0 matches + warning. Persist match deferred (cần migrate
   * BrandMention table riêng — Comment table không phù hợp vì require accountId).
   */
  private async searchPlatform(platform: AccountPlatform, _query: string): Promise<PlatformMatchResult> {
    return {
      platform,
      matches: 0,
      warning: 'search_api_not_implemented_phase_6',
    }
  }
}
