import { Injectable } from '@nestjs/common'
import type { BrandMonitor, Prisma } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'
import type { Paginated, PaginationDto } from '@sociflow/common'

@Injectable()
export class BrandMonitorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<BrandMonitor | null> {
    return this.prisma.brandMonitor.findFirst({ where: { id, deletedAt: null } })
  }

  async getByIdAndUserId(id: string, userId: string): Promise<BrandMonitor | null> {
    return this.prisma.brandMonitor.findFirst({ where: { id, userId, deletedAt: null } })
  }

  async listByUserWithPagination(
    userId: string,
    pagination: PaginationDto,
    filter?: { enabled?: boolean },
  ): Promise<Paginated<BrandMonitor>> {
    const where: Prisma.BrandMonitorWhereInput = {
      userId,
      deletedAt: null,
      ...(filter?.enabled !== undefined && { enabled: filter.enabled }),
    }
    const [list, total] = await Promise.all([
      this.prisma.brandMonitor.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.brandMonitor.count({ where }),
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
   * List monitor due to poll: enabled = true VÀ
   * - chưa từng poll (lastPolledAt IS NULL), HOẶC
   * - lastPolledAt + pollIntervalMin <= now.
   *
   * Postgres không hỗ trợ interval-from-column expr trong Prisma WhereInput nên
   * chia 2 query rồi merge ở app layer.
   */
  async listDuePollNow(now: Date, limit = 100): Promise<BrandMonitor[]> {
    const neverPolled = await this.prisma.brandMonitor.findMany({
      where: { deletedAt: null, enabled: true, lastPolledAt: null },
      take: limit,
      orderBy: { createdAt: 'asc' },
    })
    if (neverPolled.length >= limit) return neverPolled

    const remaining = limit - neverPolled.length
    const candidates = await this.prisma.brandMonitor.findMany({
      where: {
        deletedAt: null,
        enabled: true,
        lastPolledAt: { not: null },
      },
      take: remaining * 3,
      orderBy: { lastPolledAt: 'asc' },
    })
    const due = candidates.filter((m) => {
      if (!m.lastPolledAt) return true
      const nextRun = m.lastPolledAt.getTime() + m.pollIntervalMin * 60_000
      return nextRun <= now.getTime()
    }).slice(0, remaining)

    return [...neverPolled, ...due]
  }

  async create(data: Prisma.BrandMonitorCreateInput): Promise<BrandMonitor> {
    return this.prisma.brandMonitor.create({ data })
  }

  async updateById(id: string, data: Prisma.BrandMonitorUpdateInput): Promise<BrandMonitor> {
    return this.prisma.brandMonitor.update({ where: { id }, data })
  }

  async incrementMatchCount(id: string, count: number): Promise<BrandMonitor> {
    return this.prisma.brandMonitor.update({
      where: { id },
      data: { matchCount: { increment: count } },
    })
  }

  async setLastPolled(id: string, polledAt: Date): Promise<BrandMonitor> {
    return this.prisma.brandMonitor.update({
      where: { id },
      data: { lastPolledAt: polledAt },
    })
  }

  async softDeleteById(id: string): Promise<BrandMonitor> {
    return this.prisma.brandMonitor.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }
}
