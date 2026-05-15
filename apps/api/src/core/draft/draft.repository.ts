import { Injectable } from '@nestjs/common'
import type { Draft, Prisma } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'
import type { Paginated, PaginationDto } from '@sociflow/common'

@Injectable()
export class DraftRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getByIdAndUserId(id: string, userId: string): Promise<Draft | null> {
    return this.prisma.draft.findFirst({ where: { id, userId, deletedAt: null } })
  }

  async listByUserWithPagination(
    userId: string,
    pagination: PaginationDto,
    filter?: { tag?: string },
  ): Promise<Paginated<Draft>> {
    const where: Prisma.DraftWhereInput = {
      userId,
      deletedAt: null,
      ...(filter?.tag && { tags: { has: filter.tag } }),
    }
    const [list, total] = await Promise.all([
      this.prisma.draft.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.draft.count({ where }),
    ])
    return {
      list,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
    }
  }

  async create(data: Prisma.DraftCreateInput): Promise<Draft> {
    return this.prisma.draft.create({ data })
  }

  async updateById(id: string, data: Prisma.DraftUpdateInput): Promise<Draft> {
    return this.prisma.draft.update({ where: { id }, data })
  }

  async softDeleteById(id: string): Promise<Draft> {
    return this.prisma.draft.update({ where: { id }, data: { deletedAt: new Date() } })
  }
}
