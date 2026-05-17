import { Injectable } from '@nestjs/common'
import type { AccountPlatform, BrandMention, Prisma } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'
import type { Paginated, PaginationDto } from '@sociflow/common'

export interface UpsertBrandMentionInput {
  userId: string
  monitorId: string
  platform: AccountPlatform
  platformPostId?: string | null
  authorName?: string | null
  authorPlatformId?: string | null
  text: string
  permalink?: string | null
  postedAt?: Date | null
  matchedKeywords: string[]
  metadata?: Prisma.InputJsonValue
}

export interface ListBrandMentionFilter {
  monitorId?: string
  sentiment?: string
  status?: string
}

export interface UpsertBrandMentionResult {
  mention: BrandMention
  isNew: boolean
}

@Injectable()
export class BrandMentionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<BrandMention | null> {
    return this.prisma.brandMention.findUnique({ where: { id } })
  }

  async getByIdAndUserId(id: string, userId: string): Promise<BrandMention | null> {
    return this.prisma.brandMention.findFirst({ where: { id, userId } })
  }

  async listByUserWithPagination(
    userId: string,
    pagination: PaginationDto,
    filter?: ListBrandMentionFilter,
  ): Promise<Paginated<BrandMention>> {
    const where: Prisma.BrandMentionWhereInput = {
      userId,
      ...(filter?.monitorId && { monitorId: filter.monitorId }),
      ...(filter?.sentiment && { sentiment: filter.sentiment }),
      ...(filter?.status && { status: filter.status }),
    }
    const [list, total] = await Promise.all([
      this.prisma.brandMention.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.brandMention.count({ where }),
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
   * Idempotent upsert theo `(monitorId, platform, platformPostId)`.
   *
   * `platformPostId` có thể `null` (mention không có post ID rõ ràng — ví dụ
   * stub data). Khi null, unique constraint không enforce → tạo row mới mỗi
   * lần. Caller cần đảm bảo dedupe khác (vd hash text) nếu cần.
   */
  async upsertByPlatformPostId(input: UpsertBrandMentionInput): Promise<UpsertBrandMentionResult> {
    if (!input.platformPostId) {
      const created = await this.prisma.brandMention.create({
        data: this.toCreateData(input),
      })
      return { mention: created, isNew: true }
    }

    const existing = await this.prisma.brandMention.findUnique({
      where: {
        monitorId_platform_platformPostId: {
          monitorId: input.monitorId,
          platform: input.platform,
          platformPostId: input.platformPostId,
        },
      },
    })

    if (existing) {
      const updated = await this.prisma.brandMention.update({
        where: { id: existing.id },
        data: {
          text: input.text,
          authorName: input.authorName ?? existing.authorName,
          authorPlatformId: input.authorPlatformId ?? existing.authorPlatformId,
          permalink: input.permalink ?? existing.permalink,
          postedAt: input.postedAt ?? existing.postedAt,
          matchedKeywords: input.matchedKeywords,
          ...(input.metadata !== undefined && { metadata: input.metadata }),
        },
      })
      return { mention: updated, isNew: false }
    }

    const created = await this.prisma.brandMention.create({
      data: this.toCreateData(input),
    })
    return { mention: created, isNew: true }
  }

  async updateSentiment(
    id: string,
    sentiment: string,
    score: number,
  ): Promise<BrandMention> {
    return this.prisma.brandMention.update({
      where: { id },
      data: { sentiment, sentimentScore: score },
    })
  }

  async updateStatusById(id: string, status: string): Promise<BrandMention> {
    return this.prisma.brandMention.update({
      where: { id },
      data: { status },
    })
  }

  async countByUserId(userId: string): Promise<number> {
    return this.prisma.brandMention.count({ where: { userId } })
  }

  private toCreateData(input: UpsertBrandMentionInput): Prisma.BrandMentionCreateInput {
    return {
      user: { connect: { id: input.userId } },
      monitor: { connect: { id: input.monitorId } },
      platform: input.platform,
      platformPostId: input.platformPostId ?? null,
      authorName: input.authorName ?? null,
      authorPlatformId: input.authorPlatformId ?? null,
      text: input.text,
      permalink: input.permalink ?? null,
      postedAt: input.postedAt ?? null,
      matchedKeywords: input.matchedKeywords,
      ...(input.metadata !== undefined && { metadata: input.metadata }),
    }
  }
}
