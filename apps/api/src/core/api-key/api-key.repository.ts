import { Injectable } from '@nestjs/common'
import type { ApiKey, Prisma } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'
import type { Paginated, PaginationDto } from '@sociflow/common'

@Injectable()
export class ApiKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.ApiKeyCreateInput): Promise<ApiKey> {
    return this.prisma.apiKey.create({ data })
  }

  async getById(id: string): Promise<ApiKey | null> {
    return this.prisma.apiKey.findUnique({ where: { id } })
  }

  async getByIdAndUserId(id: string, userId: string): Promise<ApiKey | null> {
    return this.prisma.apiKey.findFirst({ where: { id, userId } })
  }

  async getByHash(keyHash: string): Promise<ApiKey | null> {
    return this.prisma.apiKey.findUnique({ where: { keyHash } })
  }

  /**
   * Lookup theo prefix — dùng trong validate flow:
   *  1. Extract prefix từ raw key
   *  2. Find theo prefix (index)
   *  3. Constant-time compare keyHash
   */
  async getActiveByPrefix(prefix: string): Promise<ApiKey | null> {
    return this.prisma.apiKey.findFirst({
      where: { prefix, revokedAt: null },
    })
  }

  async listByUserIdWithPagination(
    userId: string,
    pagination: PaginationDto,
    filter?: { includeRevoked?: boolean },
  ): Promise<Paginated<ApiKey>> {
    const where: Prisma.ApiKeyWhereInput = {
      userId,
      ...(!filter?.includeRevoked && { revokedAt: null }),
    }
    const [list, total] = await Promise.all([
      this.prisma.apiKey.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.apiKey.count({ where }),
    ])
    return {
      list,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
    }
  }

  async updateLastUsedAt(id: string, when: Date = new Date()): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: when },
    })
  }

  async revokeById(id: string): Promise<ApiKey> {
    return this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
  }
}
