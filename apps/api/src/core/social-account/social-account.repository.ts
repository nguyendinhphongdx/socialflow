import { Injectable } from '@nestjs/common'
import { PrismaService } from '@sociflow/prisma'
import type { AccountPlatform, AccountStatus, Prisma, SocialAccount } from '@prisma/client'
import type { Paginated, PaginationDto } from '@sociflow/common'

@Injectable()
export class SocialAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<SocialAccount | null> {
    return this.prisma.socialAccount.findFirst({ where: { id, deletedAt: null } })
  }

  async getByIdAndUserId(id: string, userId: string): Promise<SocialAccount | null> {
    return this.prisma.socialAccount.findFirst({ where: { id, userId, deletedAt: null } })
  }

  /** F-716 — workspace-scoped lookup (preferred over getByIdAndUserId). */
  async getByIdAndWorkspaceId(id: string, workspaceId: string): Promise<SocialAccount | null> {
    return this.prisma.socialAccount.findFirst({ where: { id, workspaceId, deletedAt: null } })
  }

  async getByUserPlatformUid(userId: string, platform: AccountPlatform, platformUid: string): Promise<SocialAccount | null> {
    return this.prisma.socialAccount.findFirst({ where: { userId, platform, platformUid, deletedAt: null } })
  }

  /** F-716 — lookup theo (workspace, platform, platformUid) cho upsert flow. */
  async getByWorkspacePlatformUid(workspaceId: string, platform: AccountPlatform, platformUid: string): Promise<SocialAccount | null> {
    return this.prisma.socialAccount.findFirst({ where: { workspaceId, platform, platformUid, deletedAt: null } })
  }

  /**
   * Tra cứu account theo (platform, platformUid) — dùng cho webhook handler
   * (không có userId context). Nếu nhiều user share cùng platformUid
   * lấy 1 record đầu (sort theo createdAt asc) — tạm chấp nhận; refine sau
   * nếu multi-tenant cần phân biệt.
   */
  async findByPlatformUid(platform: AccountPlatform, platformUid: string): Promise<SocialAccount | null> {
    return this.prisma.socialAccount.findFirst({
      where: { platform, platformUid, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })
  }

  /**
   * @deprecated F-716 — dùng `listByWorkspaceWithPagination` thay vì.
   * Giữ tạm cho backward compat (worker context legacy). Sẽ remove sau v2.1.
   */
  async listByUserWithPagination(
    userId: string,
    pagination: PaginationDto,
    filter?: { platform?: AccountPlatform, status?: AccountStatus },
  ): Promise<Paginated<SocialAccount>> {
    const where: Prisma.SocialAccountWhereInput = {
      userId,
      deletedAt: null,
      ...(filter?.platform && { platform: filter.platform }),
      ...(filter?.status && { status: filter.status }),
    }
    return this.paginate(where, pagination)
  }

  async listByWorkspaceWithPagination(
    workspaceId: string,
    pagination: PaginationDto,
    filter?: { platform?: AccountPlatform, status?: AccountStatus },
  ): Promise<Paginated<SocialAccount>> {
    const where: Prisma.SocialAccountWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(filter?.platform && { platform: filter.platform }),
      ...(filter?.status && { status: filter.status }),
    }
    return this.paginate(where, pagination)
  }

  private async paginate(where: Prisma.SocialAccountWhereInput, pagination: PaginationDto): Promise<Paginated<SocialAccount>> {
    const [list, total] = await Promise.all([
      this.prisma.socialAccount.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.socialAccount.count({ where }),
    ])
    return {
      list,
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.ceil(total / pagination.pageSize),
    }
  }

  async listExpiringTokens(beforeTime: Date, limit = 100): Promise<SocialAccount[]> {
    return this.prisma.socialAccount.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        publishMode: { in: ['API', 'HYBRID'] },
        tokenExpiresAt: { lte: beforeTime },
        refreshToken: { not: null },
      },
      take: limit,
      orderBy: { tokenExpiresAt: 'asc' },
    })
  }

  async create(data: Prisma.SocialAccountCreateInput): Promise<SocialAccount> {
    return this.prisma.socialAccount.create({ data })
  }

  async upsertByPlatformUid(input: {
    userId: string
    workspaceId: string
    platform: AccountPlatform
    platformUid: string
    data: Omit<Prisma.SocialAccountCreateInput, 'user' | 'workspace' | 'platform' | 'platformUid'>
  }): Promise<SocialAccount> {
    const existing = await this.getByUserPlatformUid(input.userId, input.platform, input.platformUid)
    if (existing) {
      return this.prisma.socialAccount.update({
        where: { id: existing.id },
        data: { ...input.data, deletedAt: null, workspace: { connect: { id: input.workspaceId } } },
      })
    }
    return this.prisma.socialAccount.create({
      data: {
        ...input.data,
        platform: input.platform,
        platformUid: input.platformUid,
        user: { connect: { id: input.userId } },
        workspace: { connect: { id: input.workspaceId } },
      },
    })
  }

  async updateById(id: string, data: Prisma.SocialAccountUpdateInput): Promise<SocialAccount> {
    return this.prisma.socialAccount.update({ where: { id }, data })
  }

  async softDeleteById(id: string): Promise<SocialAccount> {
    return this.prisma.socialAccount.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  /**
   * Active API/Hybrid accounts — dùng cho insight rollup daily.
   */
  async listActiveApiAccounts(limit = 500): Promise<SocialAccount[]> {
    return this.prisma.socialAccount.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        publishMode: { in: ['API', 'HYBRID'] },
      },
      take: limit,
      orderBy: { lastSyncAt: 'asc' },
    })
  }
}
