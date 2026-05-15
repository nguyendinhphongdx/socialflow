import { z } from 'zod'
import type { Comment } from '@prisma/client'
import { createPaginationVo, createZodDto } from '@sociflow/common'

export const CommentVoSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  publishRecordId: z.string().nullable(),
  platform: z.enum(['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK']),
  platformCommentId: z.string(),
  parentCommentId: z.string().nullable(),
  authorId: z.string(),
  authorName: z.string(),
  authorAvatarUrl: z.string().nullable(),
  text: z.string(),
  mediaUrl: z.string().nullable(),
  likeCount: z.number().int(),
  replyCount: z.number().int(),
  status: z.enum(['NEW', 'REPLIED', 'IGNORED', 'SPAM', 'HIDDEN', 'DELETED']),
  repliedAt: z.date().nullable(),
  replyText: z.string().nullable(),
  replyPlatformId: z.string().nullable(),
  autoReplyRuleId: z.string().nullable(),
  platformCreatedAt: z.date(),
  syncedAt: z.date(),
  updatedAt: z.date(),
})

export class CommentVo extends createZodDto(CommentVoSchema, 'CommentVo') {
  static create(entity: Comment) {
    return CommentVoSchema.parse({
      id: entity.id,
      accountId: entity.accountId,
      publishRecordId: entity.publishRecordId,
      platform: entity.platform,
      platformCommentId: entity.platformCommentId,
      parentCommentId: entity.parentCommentId,
      authorId: entity.authorId,
      authorName: entity.authorName,
      authorAvatarUrl: entity.authorAvatarUrl,
      text: entity.text,
      mediaUrl: entity.mediaUrl,
      likeCount: entity.likeCount,
      replyCount: entity.replyCount,
      status: entity.status,
      repliedAt: entity.repliedAt,
      replyText: entity.replyText,
      replyPlatformId: entity.replyPlatformId,
      autoReplyRuleId: entity.autoReplyRuleId,
      platformCreatedAt: entity.platformCreatedAt,
      syncedAt: entity.syncedAt,
      updatedAt: entity.updatedAt,
    })
  }
}

export class CommentListVo extends createPaginationVo(CommentVoSchema, 'CommentListVo') {}
