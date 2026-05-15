import { z } from 'zod'
import { createZodDto } from '@sociflow/common'
import type { PostInsight } from '@prisma/client'
import type { AccountTimelinePoint } from './insight.service'

export const PostInsightVoSchema = z.object({
  id: z.string(),
  publishRecordId: z.string(),
  snapshotAt: z.date(),
  views: z.number().int(),
  likes: z.number().int(),
  comments: z.number().int(),
  shares: z.number().int(),
  saves: z.number().int(),
  reachUnique: z.number().int(),
  raw: z.unknown().nullable(),
})

export class PostInsightVo extends createZodDto(PostInsightVoSchema, 'PostInsightVo') {
  static create(entity: PostInsight) {
    return PostInsightVoSchema.parse({
      id: entity.id,
      publishRecordId: entity.publishRecordId,
      snapshotAt: entity.snapshotAt,
      views: entity.views,
      likes: entity.likes,
      comments: entity.comments,
      shares: entity.shares,
      saves: entity.saves,
      reachUnique: entity.reachUnique,
      raw: entity.raw,
    })
  }
}

export const PostInsightListVoSchema = z.object({
  list: z.array(PostInsightVoSchema),
  total: z.number().int(),
})

export class PostInsightListVo extends createZodDto(PostInsightListVoSchema, 'PostInsightListVo') {}

export const AccountTimelinePointVoSchema = z.object({
  date: z.date(),
  followers: z.number().int(),
  followersDelta: z.number().int(),
  totalPosts: z.number().int(),
  totalEngagement: z.number().int(),
  reach: z.number().int(),
})

export class AccountTimelinePointVo extends createZodDto(AccountTimelinePointVoSchema, 'AccountTimelinePointVo') {
  static create(point: AccountTimelinePoint) {
    return AccountTimelinePointVoSchema.parse(point)
  }
}

export const AccountTimelineVoSchema = z.object({
  list: z.array(AccountTimelinePointVoSchema),
  accountId: z.string(),
  days: z.number().int(),
})

export class AccountTimelineVo extends createZodDto(AccountTimelineVoSchema, 'AccountTimelineVo') {}
