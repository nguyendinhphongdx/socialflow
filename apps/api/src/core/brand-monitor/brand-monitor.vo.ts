import { z } from 'zod'
import { createPaginationVo, createZodDto } from '@sociflow/common'
import type { BrandMonitor } from '@prisma/client'

export const BrandMonitorVoSchema = z.object({
  id: z.string(),
  name: z.string(),
  query: z.string(),
  platforms: z.array(z.enum(['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK'])),
  enabled: z.boolean(),
  pollIntervalMin: z.number().int(),
  lastPolledAt: z.date().nullable(),
  matchCount: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class BrandMonitorVo extends createZodDto(BrandMonitorVoSchema, 'BrandMonitorVo') {
  static create(entity: BrandMonitor) {
    return BrandMonitorVoSchema.parse({
      id: entity.id,
      name: entity.name,
      query: entity.query,
      platforms: entity.platforms,
      enabled: entity.enabled,
      pollIntervalMin: entity.pollIntervalMin,
      lastPolledAt: entity.lastPolledAt,
      matchCount: entity.matchCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    })
  }
}

export class BrandMonitorListVo extends createPaginationVo(BrandMonitorVoSchema, 'BrandMonitorListVo') {}

/**
 * Output cho manual poll trigger — số match tìm thấy + breakdown theo platform.
 */
export const BrandMonitorPollResultVoSchema = z.object({
  monitorId: z.string(),
  polledAt: z.date(),
  totalMatches: z.number().int(),
  perPlatform: z.record(z.string(), z.number().int()),
  warnings: z.array(z.string()),
})

export class BrandMonitorPollResultVo extends createZodDto(BrandMonitorPollResultVoSchema, 'BrandMonitorPollResultVo') {}
