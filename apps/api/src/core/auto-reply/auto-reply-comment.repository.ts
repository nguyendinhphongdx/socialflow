import { Injectable } from '@nestjs/common'
import type { Comment } from '@prisma/client'
import { PrismaService } from '@sociflow/prisma'

/**
 * Read-only repository load Comment + relations cần cho auto-reply matching
 * và template rendering. Tách ra để không phải import CommentModule
 * (chưa tồn tại) — khi CommentModule có thể inject service tương đương.
 */
export interface CommentForMatching {
  id: string
  text: string
  platform: Comment['platform']
  accountId: string
  authorName: string
  publishRecordTitle: string | null
}

@Injectable()
export class AutoReplyCommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getForMatching(commentId: string): Promise<CommentForMatching | null> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: {
        id: true,
        text: true,
        platform: true,
        accountId: true,
        authorName: true,
        publishRecord: { select: { title: true } },
      },
    })
    if (!comment) return null
    return {
      id: comment.id,
      text: comment.text,
      platform: comment.platform,
      accountId: comment.accountId,
      authorName: comment.authorName,
      publishRecordTitle: comment.publishRecord?.title ?? null,
    }
  }

  /**
   * Cập nhật Comment.autoReplyRuleId + replyPlatformId + replyText sau khi
   * consumer reply thành công. Đây là cập nhật bookkeeping nội module.
   */
  async markReplied(
    commentId: string,
    ruleId: string,
    replyText: string,
    platformReplyId?: string,
  ): Promise<void> {
    await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        autoReplyRuleId: ruleId,
        replyText,
        replyPlatformId: platformReplyId ?? null,
        repliedAt: new Date(),
        status: 'REPLIED',
      },
    })
  }
}
