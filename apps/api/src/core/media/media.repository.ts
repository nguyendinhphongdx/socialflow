import { Injectable } from '@nestjs/common'
import type { MediaAsset, MediaStatus, MediaType, Prisma } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'
import type { Paginated, PaginationDto } from '@sociflow/common'

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<MediaAsset | null> {
    return this.prisma.mediaAsset.findFirst({ where: { id, deletedAt: null } })
  }

  async getByIdAndUserId(id: string, userId: string): Promise<MediaAsset | null> {
    return this.prisma.mediaAsset.findFirst({ where: { id, userId, deletedAt: null } })
  }

  async listByIdsAndUserId(ids: string[], userId: string): Promise<MediaAsset[]> {
    if (ids.length === 0) return []
    return this.prisma.mediaAsset.findMany({
      where: { id: { in: ids }, userId, deletedAt: null },
    })
  }

  async listByUserWithPagination(
    userId: string,
    pagination: PaginationDto,
    filter?: { type?: MediaType, status?: MediaStatus },
  ): Promise<Paginated<MediaAsset>> {
    const where: Prisma.MediaAssetWhereInput = {
      userId,
      deletedAt: null,
      ...(filter?.type && { type: filter.type }),
      ...(filter?.status && { status: filter.status }),
    }
    const [list, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mediaAsset.count({ where }),
    ])
    return {
      list,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
    }
  }

  async create(data: Prisma.MediaAssetCreateInput): Promise<MediaAsset> {
    return this.prisma.mediaAsset.create({ data })
  }

  async updateById(id: string, data: Prisma.MediaAssetUpdateInput): Promise<MediaAsset> {
    return this.prisma.mediaAsset.update({ where: { id }, data })
  }

  async softDeleteById(id: string): Promise<MediaAsset> {
    return this.prisma.mediaAsset.update({ where: { id }, data: { deletedAt: new Date() } })
  }
}
