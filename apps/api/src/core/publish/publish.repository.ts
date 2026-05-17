import { Injectable } from '@nestjs/common'
import type { Prisma, PublishRecord, PublishStatus, SocialAccount } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'
import type { Paginated, PaginationDto } from '@sociflow/common'

export type PublishRecordWithAccount = PublishRecord & {
  account: Pick<SocialAccount, 'platform' | 'displayName'>
}

@Injectable()
export class PublishRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** @deprecated F-716 — dùng `getByIdAndWorkspaceId`. */
  async getByIdAndUserId(id: string, userId: string): Promise<PublishRecordWithAccount | null> {
    return this.prisma.publishRecord.findFirst({
      where: { id, userId, deletedAt: null },
      include: { account: { select: { platform: true, displayName: true } } },
    })
  }

  async getByIdAndWorkspaceId(id: string, workspaceId: string): Promise<PublishRecordWithAccount | null> {
    return this.prisma.publishRecord.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: { account: { select: { platform: true, displayName: true } } },
    })
  }

  async getById(id: string): Promise<PublishRecord | null> {
    return this.prisma.publishRecord.findFirst({ where: { id, deletedAt: null } })
  }

  /** @deprecated F-716 — dùng `getByWorkspaceIdAndIdempotencyKey`. */
  async getByIdempotencyKey(userId: string, key: string): Promise<PublishRecord | null> {
    return this.prisma.publishRecord.findFirst({
      where: { userId, idempotencyKey: key, deletedAt: null },
    })
  }

  async getByWorkspaceIdAndIdempotencyKey(workspaceId: string, key: string): Promise<PublishRecord | null> {
    return this.prisma.publishRecord.findFirst({
      where: { workspaceId, idempotencyKey: key, deletedAt: null },
    })
  }

  /** @deprecated F-716 — dùng `listByWorkspaceWithPagination`. */
  async listByUserWithPagination(
    userId: string,
    pagination: PaginationDto,
    filter?: { status?: PublishStatus, accountId?: string, flowId?: string },
  ): Promise<Paginated<PublishRecordWithAccount>> {
    const where: Prisma.PublishRecordWhereInput = {
      userId,
      deletedAt: null,
      ...(filter?.status && { status: filter.status }),
      ...(filter?.accountId && { accountId: filter.accountId }),
      ...(filter?.flowId && { flowId: filter.flowId }),
    }
    return this.paginate(where, pagination)
  }

  async listByWorkspaceWithPagination(
    workspaceId: string,
    pagination: PaginationDto,
    filter?: { status?: PublishStatus, accountId?: string, flowId?: string },
  ): Promise<Paginated<PublishRecordWithAccount>> {
    const where: Prisma.PublishRecordWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(filter?.status && { status: filter.status }),
      ...(filter?.accountId && { accountId: filter.accountId }),
      ...(filter?.flowId && { flowId: filter.flowId }),
    }
    return this.paginate(where, pagination)
  }

  private async paginate(where: Prisma.PublishRecordWhereInput, pagination: PaginationDto): Promise<Paginated<PublishRecordWithAccount>> {
    const [list, total] = await Promise.all([
      this.prisma.publishRecord.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
        include: { account: { select: { platform: true, displayName: true } } },
      }),
      this.prisma.publishRecord.count({ where }),
    ])
    return {
      list,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
    }
  }

  async listDueForPublish(now: Date, limit = 100): Promise<PublishRecord[]> {
    return this.prisma.publishRecord.findMany({
      where: {
        deletedAt: null,
        status: { in: ['SCHEDULED', 'PENDING'] },
        publishTime: { lte: now },
      },
      take: limit,
      orderBy: { publishTime: 'asc' },
    })
  }

  async createMany(records: Prisma.PublishRecordCreateManyInput[]): Promise<PublishRecord[]> {
    await this.prisma.publishRecord.createMany({ data: records })
    return this.prisma.publishRecord.findMany({
      where: { id: { in: records.map(r => r.id ?? '').filter(Boolean) } },
    })
  }

  async create(data: Prisma.PublishRecordCreateInput): Promise<PublishRecord> {
    return this.prisma.publishRecord.create({ data })
  }

  async updateById(id: string, data: Prisma.PublishRecordUpdateInput): Promise<PublishRecord> {
    return this.prisma.publishRecord.update({ where: { id }, data })
  }

  async markStatusAtomic(id: string, expectedStatus: PublishStatus, nextStatus: PublishStatus, extra?: Prisma.PublishRecordUpdateInput): Promise<boolean> {
    const result = await this.prisma.publishRecord.updateMany({
      where: { id, status: expectedStatus },
      data: { status: nextStatus, ...extra },
    })
    return result.count === 1
  }

  async softDeleteById(id: string): Promise<PublishRecord> {
    return this.prisma.publishRecord.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  /**
   * Publish records đã PUBLISHED của 1 account trong khoảng [from, to] — dùng cho
   * insight aggregation (rollup daily metric).
   */
  async listPublishedByAccountInRange(accountId: string, fromDate: Date, toDate: Date): Promise<PublishRecord[]> {
    return this.prisma.publishRecord.findMany({
      where: {
        accountId,
        deletedAt: null,
        status: 'PUBLISHED',
        publishedAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { publishedAt: 'asc' },
    })
  }

  /**
   * Publish records đã PUBLISHED gần đây (last N days) — input cho insight scheduler
   * snapshot job. Trả nhẹ (id, accountId, platformPostId) đủ enqueue.
   */
  async listRecentPublishedWithPlatformPostId(sinceDate: Date, limit = 500): Promise<PublishRecord[]> {
    return this.prisma.publishRecord.findMany({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        publishedAt: { gte: sinceDate },
        platformPostId: { not: null },
      },
      take: limit,
      orderBy: { publishedAt: 'desc' },
    })
  }
}
