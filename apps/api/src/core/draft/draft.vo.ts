import { z } from 'zod'
import { createPaginationVo, createZodDto } from '@sociflow/common'
import type { Draft, PublishRecord } from '@prisma/client'

export const DraftVoSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  body: z.string().nullable(),
  mediaIds: z.array(z.string()),
  platformOptions: z.record(z.string(), z.unknown()).nullable(),
  tags: z.array(z.string()),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class DraftVo extends createZodDto(DraftVoSchema, 'DraftVo') {
  static create(entity: Draft) {
    return DraftVoSchema.parse({
      id: entity.id,
      title: entity.title,
      body: entity.body,
      mediaIds: entity.mediaIds,
      platformOptions: (entity.platformOptions ?? null) as Record<string, unknown> | null,
      tags: entity.tags,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    })
  }
}

export class DraftListVo extends createPaginationVo(DraftVoSchema, 'DraftListVo') {}

export const DraftPublishResultVoSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  flowId: z.string().nullable(),
  status: z.enum([
    'PENDING', 'SCHEDULED', 'WAITING_AGENT', 'DISPATCHED', 'IN_PROGRESS',
    'REVIEW_PENDING', 'PUBLISHED', 'FAILED', 'CANCELLED', 'REJECTED',
  ]),
  publishTime: z.date(),
})

export class DraftPublishResultVo extends createZodDto(DraftPublishResultVoSchema, 'DraftPublishResultVo') {
  static create(entity: PublishRecord) {
    return DraftPublishResultVoSchema.parse({
      id: entity.id,
      accountId: entity.accountId,
      flowId: entity.flowId,
      status: entity.status,
      publishTime: entity.publishTime,
    })
  }
}
