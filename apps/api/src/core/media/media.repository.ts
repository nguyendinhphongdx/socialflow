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

  /** @deprecated F-716 — dùng `getByIdAndWorkspaceId`. */
  async getByIdAndUserId(id: string, userId: string): Promise<MediaAsset | null> {
    return this.prisma.mediaAsset.findFirst({ where: { id, userId, deletedAt: null } })
  }

  async getByIdAndWorkspaceId(id: string, workspaceId: string): Promise<MediaAsset | null> {
    return this.prisma.mediaAsset.findFirst({ where: { id, workspaceId, deletedAt: null } })
  }

  /** @deprecated F-716 — dùng `listByIdsAndWorkspaceId`. */
  async listByIdsAndUserId(ids: string[], userId: string): Promise<MediaAsset[]> {
    if (ids.length === 0) return []
    return this.prisma.mediaAsset.findMany({
      where: { id: { in: ids }, userId, deletedAt: null },
    })
  }

  async listByIdsAndWorkspaceId(ids: string[], workspaceId: string): Promise<MediaAsset[]> {
    if (ids.length === 0) return []
    return this.prisma.mediaAsset.findMany({
      where: { id: { in: ids }, workspaceId, deletedAt: null },
    })
  }

  /** @deprecated F-716 — dùng `listByWorkspaceWithPagination`. */
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
    return this.paginate(where, pagination)
  }

  async listByWorkspaceWithPagination(
    workspaceId: string,
    pagination: PaginationDto,
    filter?: { type?: MediaType, status?: MediaStatus },
  ): Promise<Paginated<MediaAsset>> {
    const where: Prisma.MediaAssetWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(filter?.type && { type: filter.type }),
      ...(filter?.status && { status: filter.status }),
    }
    return this.paginate(where, pagination)
  }

  private async paginate(where: Prisma.MediaAssetWhereInput, pagination: PaginationDto): Promise<Paginated<MediaAsset>> {
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
