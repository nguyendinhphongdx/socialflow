import { Injectable, Logger } from '@nestjs/common'
import type { AccountPlatform, AutoReplyRule } from '@prisma/client'
import { AppException, ResponseCode, type PaginationDto } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { AutoReplyRuleRepository } from './auto-reply-rule.repository'
import type {
  CreateAutoReplyRuleDto,
  ListAutoReplyRuleDto,
  UpdateAutoReplyRuleDto,
} from './auto-reply.dto'

/**
 * Subset comment fields cần để chạy matching. Tách type để service không
 * phụ thuộc Comment relation full (test dễ hơn, và Comment module chưa tồn tại).
 */
export interface MatchableComment {
  text: string
  platform: AccountPlatform
  accountId: string
}

@Injectable()
export class AutoReplyRuleService {
  private readonly logger = new Logger(AutoReplyRuleService.name)

  constructor(
    private readonly repo: AutoReplyRuleRepository,
    private readonly ctx: RequestContextService,
  ) {}

  async create(dto: CreateAutoReplyRuleDto): Promise<AutoReplyRule> {
    const userId = this.ctx.requireUserId()
    return this.repo.create({
      user: { connect: { id: userId } },
      name: dto.name,
      enabled: dto.enabled,
      platforms: dto.platforms,
      accountIds: dto.accountIds,
      keywordsAny: dto.keywordsAny,
      keywordsAll: dto.keywordsAll,
      keywordsNone: dto.keywordsNone,
      replyTemplate: dto.replyTemplate,
      replyDelaySec: dto.replyDelaySec,
      maxRepliesPerDay: dto.maxRepliesPerDay,
    })
  }

  async listByCurrentUser(query: ListAutoReplyRuleDto) {
    const userId = this.ctx.requireUserId()
    const pagination: PaginationDto = { page: query.page, pageSize: query.pageSize }
    return this.repo.listByUserWithPagination(userId, pagination, {
      enabled: query.enabled,
      platform: query.platform,
    })
  }

  async getByCurrentUserAndId(id: string): Promise<AutoReplyRule> {
    const userId = this.ctx.requireUserId()
    const rule = await this.repo.getByIdAndUserId(id, userId)
    if (!rule) throw new AppException(ResponseCode.AutoReplyRuleNotFound, { ruleId: id })
    return rule
  }

  async update(id: string, dto: UpdateAutoReplyRuleDto): Promise<AutoReplyRule> {
    const existing = await this.getByCurrentUserAndId(id)
    return this.repo.updateById(existing.id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      ...(dto.platforms !== undefined && { platforms: dto.platforms }),
      ...(dto.accountIds !== undefined && { accountIds: dto.accountIds }),
      ...(dto.keywordsAny !== undefined && { keywordsAny: dto.keywordsAny }),
      ...(dto.keywordsAll !== undefined && { keywordsAll: dto.keywordsAll }),
      ...(dto.keywordsNone !== undefined && { keywordsNone: dto.keywordsNone }),
      ...(dto.replyTemplate !== undefined && { replyTemplate: dto.replyTemplate }),
      ...(dto.replyDelaySec !== undefined && { replyDelaySec: dto.replyDelaySec }),
      ...(dto.maxRepliesPerDay !== undefined && { maxRepliesPerDay: dto.maxRepliesPerDay }),
    })
  }

  async softDelete(id: string): Promise<void> {
    const rule = await this.getByCurrentUserAndId(id)
    await this.repo.softDeleteById(rule.id)
  }

  async toggleEnabled(id: string): Promise<AutoReplyRule> {
    const rule = await this.getByCurrentUserAndId(id)
    return this.repo.updateById(rule.id, { enabled: !rule.enabled })
  }

  /**
   * Pure matching logic — lọc rule với comment.
   *
   * Quy tắc:
   *  - rule.enabled = true (đã filter ở repo, nhưng giữ guard)
   *  - rule.platforms chứa comment.platform
   *  - rule.accountIds rỗng HOẶC chứa comment.accountId
   *  - text chứa ít nhất 1 keyword trong keywordsAny (case-insensitive)
   *  - text chứa TẤT CẢ keywordsAll
   *  - text KHÔNG chứa keyword nào trong keywordsNone
   *
   * Caller (processor) chịu trách nhiệm load `rules` qua
   * `repo.listEnabledForMatching(userId, platform, accountId)` rồi truyền vào.
   */
  matchRules(comment: MatchableComment, rules: AutoReplyRule[]): AutoReplyRule[] {
    const text = comment.text.toLowerCase()
    return rules.filter(rule => this.ruleMatchesText(rule, text, comment))
  }

  private ruleMatchesText(rule: AutoReplyRule, text: string, comment: MatchableComment): boolean {
    if (!rule.enabled) return false
    if (!rule.platforms.includes(comment.platform)) return false
    if (rule.accountIds.length > 0 && !rule.accountIds.includes(comment.accountId)) return false

    const any = rule.keywordsAny.length === 0
      || rule.keywordsAny.some(k => text.includes(k.toLowerCase()))
    if (!any) return false

    const all = rule.keywordsAll.every(k => text.includes(k.toLowerCase()))
    if (!all) return false

    const hasExcluded = rule.keywordsNone.some(k => text.includes(k.toLowerCase()))
    if (hasExcluded) return false

    return true
  }
}
