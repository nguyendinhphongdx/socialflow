import { Injectable } from '@nestjs/common'
import type { AccountPlatform, AutoReplyRule, Prisma } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'
import type { Paginated, PaginationDto } from '@sociflow/common'

interface ListFilter {
  enabled?: boolean
  platform?: AccountPlatform
}

@Injectable()
export class AutoReplyRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getByIdAndUserId(id: string, userId: string): Promise<AutoReplyRule | null> {
    return this.prisma.autoReplyRule.findFirst({
      where: { id, userId, deletedAt: null },
    })
  }

  async getById(id: string): Promise<AutoReplyRule | null> {
    return this.prisma.autoReplyRule.findFirst({ where: { id, deletedAt: null } })
  }

  async listByUserWithPagination(
    userId: string,
    pagination: PaginationDto,
    filter?: ListFilter,
  ): Promise<Paginated<AutoReplyRule>> {
    const where: Prisma.AutoReplyRuleWhereInput = {
      userId,
      deletedAt: null,
      ...(filter?.enabled !== undefined && { enabled: filter.enabled }),
      ...(filter?.platform && { platforms: { has: filter.platform } }),
    }
    const [list, total] = await Promise.all([
      this.prisma.autoReplyRule.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.autoReplyRule.count({ where }),
    ])
    return {
      list,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
    }
  }

  /**
   * Liệt kê rule active có thể match comment đến.
   * Filter:
   *  - enabled = true
   *  - chứa platform (array contains)
   *  - accountIds empty (apply all) HOẶC chứa accountId
   */
  async listEnabledForMatching(
    userId: string,
    platform: AccountPlatform,
    accountId?: string,
  ): Promise<AutoReplyRule[]> {
    const where: Prisma.AutoReplyRuleWhereInput = {
      userId,
      enabled: true,
      deletedAt: null,
      platforms: { has: platform },
      ...(accountId && {
        OR: [
          { accountIds: { isEmpty: true } },
          { accountIds: { has: accountId } },
        ],
      }),
    }
    return this.prisma.autoReplyRule.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    })
  }

  async create(data: Prisma.AutoReplyRuleCreateInput): Promise<AutoReplyRule> {
    return this.prisma.autoReplyRule.create({ data })
  }

  async updateById(id: string, data: Prisma.AutoReplyRuleUpdateInput): Promise<AutoReplyRule> {
    return this.prisma.autoReplyRule.update({ where: { id }, data })
  }

  async softDeleteById(id: string): Promise<AutoReplyRule> {
    return this.prisma.autoReplyRule.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  async incrementMatchCount(id: string): Promise<void> {
    await this.prisma.autoReplyRule.update({
      where: { id },
      data: { matchCount: { increment: 1 } },
    })
  }

  /**
   * Atomic increment repliesToday + replyCount. Caller phải reset quota TRƯỚC
   * khi gọi (qua `resetDailyQuotaIfNeeded`).
   */
  async incrementReplyCount(id: string): Promise<void> {
    await this.prisma.autoReplyRule.update({
      where: { id },
      data: {
        replyCount: { increment: 1 },
        repliesToday: { increment: 1 },
      },
    })
  }

  /**
   * Atomic reset quota — chỉ reset nếu `lastResetAt < startOfToday`.
   * Trả về số row affected (0 hoặc 1). 0 = đã reset rồi, không cần làm gì.
   *
   * Dùng `updateMany` để guard điều kiện ngay trong WHERE clause — race-free.
   */
  async resetDailyQuotaIfNeeded(id: string, now: Date): Promise<number> {
    const startOfToday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0,
    ))
    const result = await this.prisma.autoReplyRule.updateMany({
      where: {
        id,
        lastResetAt: { lt: startOfToday },
      },
      data: {
        repliesToday: 0,
        lastResetAt: now,
      },
    })
    return result.count
  }
}
