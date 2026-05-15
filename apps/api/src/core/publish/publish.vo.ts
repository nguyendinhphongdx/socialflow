import { z } from 'zod'
import { createPaginationVo, createZodDto } from '@sociflow/common'
import type { PublishRecord, SocialAccount } from '@prisma/client'

export const PublishRecordVoSchema = z.object({
  id: z.string(),
  flowId: z.string().nullable(),
  accountId: z.string(),
  accountPlatform: z.enum(['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK']),
  accountDisplayName: z.string(),
  publishMode: z.enum(['API', 'AUTOMATION', 'HYBRID']),
  title: z.string().nullable(),
  body: z.string().nullable(),
  mediaIds: z.array(z.string()),
  publishTime: z.date(),
  publishedAt: z.date().nullable(),
  status: z.enum([
    'PENDING', 'SCHEDULED', 'WAITING_AGENT', 'DISPATCHED', 'IN_PROGRESS',
    'REVIEW_PENDING', 'PUBLISHED', 'FAILED', 'CANCELLED', 'REJECTED',
  ]),
  stage: z.string().nullable(),
  errorMessage: z.string().nullable(),
  platformPostId: z.string().nullable(),
  workLink: z.string().nullable(),
  retryCount: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

type PublishRecordWithAccount = PublishRecord & { account: Pick<SocialAccount, 'platform' | 'displayName'> }

export class PublishRecordVo extends createZodDto(PublishRecordVoSchema, 'PublishRecordVo') {
  static create(entity: PublishRecordWithAccount) {
    return PublishRecordVoSchema.parse({
      id: entity.id,
      flowId: entity.flowId,
      accountId: entity.accountId,
      accountPlatform: entity.account.platform,
      accountDisplayName: entity.account.displayName,
      publishMode: entity.publishMode,
      title: entity.title,
      body: entity.body,
      mediaIds: entity.mediaIds,
      publishTime: entity.publishTime,
      publishedAt: entity.publishedAt,
      status: entity.status,
      stage: entity.stage,
      errorMessage: entity.errorMessage,
      platformPostId: entity.platformPostId,
      workLink: entity.workLink,
      retryCount: entity.retryCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    })
  }
}

export class PublishRecordListVo extends createPaginationVo(PublishRecordVoSchema, 'PublishRecordListVo') {}
