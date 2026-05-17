import { Injectable } from '@nestjs/common'
import { PrismaService } from '@sociflow/prisma'
import type {
  AccountPlatform,
  Comment,
  CommentStatus,
  Prisma,
} from '@prisma/client'
import type { Paginated, PaginationDto } from '@sociflow/common'

export interface CommentListFilter {
  status?: CommentStatus
  accountId?: string
  platform?: AccountPlatform
  publishRecordId?: string
  hasReply?: boolean
  search?: string
}

export interface IngestCommentInput {
  userId: string
  accountId: string
  publishRecordId?: string | null
  platform: AccountPlatform
  platformCommentId: string
  parentCommentId?: string | null
  authorId: string
  authorName: string
  authorAvatarUrl?: string | null
  text: string
  mediaUrl?: string | null
  likeCount?: number
  replyCount?: number
  platformCreatedAt: Date
}

export interface UpsertResult {
  comment: Comment
  /** true nếu record vừa được insert (lần đầu thấy comment này) */
  isNew: boolean
}

@Injectable()
export class CommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<Comment | null> {
    return this.prisma.comment.findFirst({ where: { id, deletedAt: null } })
  }

  async getByIdAndUserId(id: string, userId: string): Promise<Comment | null> {
    return this.prisma.comment.findFirst({
      where: { id, userId, deletedAt: null },
    })
  }

  async getByAccountAndPlatformCommentId(
    accountId: string,
    platformCommentId: string,
  ): Promise<Comment | null> {
    return this.prisma.comment.findFirst({
      where: { accountId, platformCommentId, deletedAt: null },
    })
  }

  async listByUserWithPagination(
    userId: string,
    pagination: PaginationDto,
    filter?: CommentListFilter,
  ): Promise<Paginated<Comment>> {
    const where: Prisma.CommentWhereInput = {
      userId,
      deletedAt: null,
      ...(filter?.status && { status: filter.status }),
      ...(filter?.accountId && { accountId: filter.accountId }),
      ...(filter?.platform && { platform: filter.platform }),
      ...(filter?.publishRecordId && { publishRecordId: filter.publishRecordId }),
      ...(filter?.hasReply === true && { repliedAt: { not: null } }),
      ...(filter?.hasReply === false && { repliedAt: null }),
      ...(filter?.search && {
        OR: [
          { text: { contains: filter.search, mode: 'insensitive' } },
          { authorName: { contains: filter.search, mode: 'insensitive' } },
        ],
      }),
    }
    const [list, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { platformCreatedAt: 'desc' },
      }),
      this.prisma.comment.count({ where }),
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
   * Atomic upsert theo (accountId, platformCommentId).
   *
   * - Insert mới: status=NEW, snapshot author/text/createdAt
   * - Update: cập nhật likeCount/replyCount/text (edited), syncedAt
   *
   * Trả về `{ comment, isNew }` để caller emit `comment.new` chỉ khi insert lần đầu.
   * Idempotency phụ thuộc unique index (accountId, platformCommentId) trong schema.
   */
  async upsertByPlatformId(input: IngestCommentInput): Promise<UpsertResult> {
    const existing = await this.getByAccountAndPlatformCommentId(
      input.accountId,
      input.platformCommentId,
    )

    if (existing) {
      const updated = await this.prisma.comment.update({
        where: { id: existing.id },
        data: {
          text: input.text,
          mediaUrl: input.mediaUrl ?? null,
          likeCount: input.likeCount ?? existing.likeCount,
          replyCount: input.replyCount ?? existing.replyCount,
          syncedAt: new Date(),
        },
      })
      return { comment: updated, isNew: false }
    }

    const created = await this.prisma.comment.create({
      data: {
        user: { connect: { id: input.userId } },
        account: { connect: { id: input.accountId } },
        ...(input.publishRecordId && {
          publishRecord: { connect: { id: input.publishRecordId } },
        }),
        platform: input.platform,
        platformCommentId: input.platformCommentId,
        parentCommentId: input.parentCommentId ?? null,
        authorId: input.authorId,
        authorName: input.authorName,
        authorAvatarUrl: input.authorAvatarUrl ?? null,
        text: input.text,
        mediaUrl: input.mediaUrl ?? null,
        likeCount: input.likeCount ?? 0,
        replyCount: input.replyCount ?? 0,
        status: 'NEW',
        platformCreatedAt: input.platformCreatedAt,
      },
    })
    return { comment: created, isNew: true }
  }

  async create(data: Prisma.CommentCreateInput): Promise<Comment> {
    return this.prisma.comment.create({ data })
  }

  async updateById(id: string, data: Prisma.CommentUpdateInput): Promise<Comment> {
    return this.prisma.comment.update({ where: { id }, data })
  }

  async updateStatusById(id: string, status: CommentStatus): Promise<Comment> {
    return this.prisma.comment.update({ where: { id }, data: { status } })
  }

  async markRepliedById(
    id: string,
    replyText: string,
    replyPlatformId: string | undefined,
    autoReplyRuleId?: string,
  ): Promise<Comment> {
    return this.prisma.comment.update({
      where: { id },
      data: {
        status: 'REPLIED',
        replyText,
        replyPlatformId: replyPlatformId ?? null,
        repliedAt: new Date(),
        ...(autoReplyRuleId && { autoReplyRuleId }),
      },
    })
  }

  async softDeleteById(id: string): Promise<Comment> {
    return this.prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  async listByIdsAndUserId(ids: string[], userId: string): Promise<Comment[]> {
    if (ids.length === 0) return []
    return this.prisma.comment.findMany({
      where: { id: { in: ids }, userId, deletedAt: null },
    })
  }

  async updateManyStatusByIdsAndUserId(
    ids: string[],
    userId: string,
    status: CommentStatus,
  ): Promise<number> {
    if (ids.length === 0) return 0
    const result = await this.prisma.comment.updateMany({
      where: { id: { in: ids }, userId, deletedAt: null },
      data: { status },
    })
    return result.count
  }

  async softDeleteManyByIdsAndUserId(ids: string[], userId: string): Promise<number> {
    if (ids.length === 0) return 0
    const result = await this.prisma.comment.updateMany({
      where: { id: { in: ids }, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    return result.count
  }

  /**
   * Lấy PublishRecord PUBLISHED gần đây có platformPostId cho 1 account
   * — dùng cho sync scheduler poll comments theo từng post.
   */
  async listRecentPublishedPostsByAccount(
    accountId: string,
    since: Date,
    limit = 50,
  ): Promise<Array<{ id: string, platformPostId: string }>> {
    const records = await this.prisma.publishRecord.findMany({
      where: {
        accountId,
        status: 'PUBLISHED',
        publishedAt: { gte: since },
        platformPostId: { not: null },
        deletedAt: null,
      },
      select: { id: true, platformPostId: true },
      take: limit,
      orderBy: { publishedAt: 'desc' },
    })
    return records
      .filter((r): r is { id: string, platformPostId: string } => r.platformPostId !== null)
  }
}
