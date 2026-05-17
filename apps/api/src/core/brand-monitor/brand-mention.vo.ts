import { z } from 'zod'
import { createPaginationVo, createZodDto } from '@sociflow/common'
import type { BrandMention } from '@prisma/client'

export const BrandMentionVoSchema = z.object({
  id: z.string(),
  monitorId: z.string(),
  platform: z.enum(['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK']),
  platformPostId: z.string().nullable(),
  authorName: z.string().nullable(),
  authorPlatformId: z.string().nullable(),
  text: z.string(),
  permalink: z.string().nullable(),
  postedAt: z.date().nullable(),
  matchedKeywords: z.array(z.string()),
  sentiment: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']).nullable(),
  sentimentScore: z.number().nullable(),
  status: z.enum(['NEW', 'ACKED', 'ARCHIVED']),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class BrandMentionVo extends createZodDto(BrandMentionVoSchema, 'BrandMentionVo') {
  static create(entity: BrandMention) {
    return BrandMentionVoSchema.parse({
      id: entity.id,
      monitorId: entity.monitorId,
      platform: entity.platform,
      platformPostId: entity.platformPostId,
      authorName: entity.authorName,
      authorPlatformId: entity.authorPlatformId,
      text: entity.text,
      permalink: entity.permalink,
      postedAt: entity.postedAt,
      matchedKeywords: entity.matchedKeywords,
      sentiment: entity.sentiment as 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | null,
      sentimentScore: entity.sentimentScore,
      status: entity.status as 'NEW' | 'ACKED' | 'ARCHIVED',
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    })
  }
}

export class BrandMentionListVo extends createPaginationVo(BrandMentionVoSchema, 'BrandMentionListVo') {}
