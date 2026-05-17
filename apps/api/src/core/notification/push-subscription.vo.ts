import { z } from 'zod'
import type { PushSubscription } from '@prisma/client'
import { createZodDto } from '@sociflow/common'

export const PushSubscriptionVoSchema = z.object({
  id: z.string(),
  endpoint: z.string(),
  deviceTag: z.string().nullable(),
  createdAt: z.date(),
  lastUsed: z.date().nullable(),
})

export class PushSubscriptionVo extends createZodDto(PushSubscriptionVoSchema, 'PushSubscriptionVo') {
  static create(entity: PushSubscription) {
    // Endpoint redact phần cuối — không expose full push service URL ra FE
    // (chứa token-like segment riêng device).
    const redactedEndpoint = entity.endpoint.length > 60
      ? `${entity.endpoint.slice(0, 50)}…${entity.endpoint.slice(-8)}`
      : entity.endpoint
    return PushSubscriptionVoSchema.parse({
      id: entity.id,
      endpoint: redactedEndpoint,
      deviceTag: entity.deviceTag,
      createdAt: entity.createdAt,
      lastUsed: entity.lastUsed,
    })
  }
}

export const PushSubscriptionListVoSchema = z.object({
  list: z.array(PushSubscriptionVoSchema),
  total: z.number().int(),
})

export class PushSubscriptionListVo extends createZodDto(PushSubscriptionListVoSchema, 'PushSubscriptionListVo') {
  static create(entities: PushSubscription[]) {
    return PushSubscriptionListVoSchema.parse({
      list: entities.map(PushSubscriptionVo.create),
      total: entities.length,
    })
  }
}
