import { z } from 'zod'
import { createPaginationVo, createZodDto } from '@sociflow/common'
import type { SocialAccount } from '@prisma/client'

export const SocialAccountVoSchema = z.object({
  id: z.string(),
  platform: z.enum(['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK']),
  platformUid: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  publishMode: z.enum(['API', 'AUTOMATION', 'HYBRID']),
  status: z.enum(['ACTIVE', 'TOKEN_EXPIRED', 'REVOKED', 'SUSPENDED']),
  scopes: z.array(z.string()),
  tokenExpiresAt: z.date().nullable(),
  lastSyncAt: z.date().nullable(),
  metadata: z.unknown().nullable(),
  groupId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class SocialAccountVo extends createZodDto(SocialAccountVoSchema, 'SocialAccountVo') {
  /**
   * Map entity → VO. Strip sensitive (accessToken/refreshToken).
   */
  static create(entity: SocialAccount) {
    return SocialAccountVoSchema.parse({
      id: entity.id,
      platform: entity.platform,
      platformUid: entity.platformUid,
      displayName: entity.displayName,
      avatarUrl: entity.avatarUrl,
      publishMode: entity.publishMode,
      status: entity.status,
      scopes: entity.scopes,
      tokenExpiresAt: entity.tokenExpiresAt,
      lastSyncAt: entity.lastSyncAt,
      metadata: entity.metadata,
      groupId: entity.groupId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    })
  }
}

export class SocialAccountListVo extends createPaginationVo(SocialAccountVoSchema, 'SocialAccountListVo') {}
