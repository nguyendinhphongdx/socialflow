import { z } from 'zod'
import { AccountPlatform, type AutoReplyRule } from '@prisma/client'
import { createPaginationVo, createZodDto } from '@sociflow/common'

export const AutoReplyRuleVoSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  platforms: z.array(z.nativeEnum(AccountPlatform)),
  accountIds: z.array(z.string()),
  keywordsAny: z.array(z.string()),
  keywordsAll: z.array(z.string()),
  keywordsNone: z.array(z.string()),
  replyTemplate: z.string(),
  replyDelaySec: z.number().int(),
  maxRepliesPerDay: z.number().int(),
  repliesToday: z.number().int(),
  matchCount: z.number().int(),
  replyCount: z.number().int(),
  lastResetAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class AutoReplyRuleVo extends createZodDto(AutoReplyRuleVoSchema, 'AutoReplyRuleVo') {
  static create(entity: AutoReplyRule) {
    return AutoReplyRuleVoSchema.parse({
      id: entity.id,
      name: entity.name,
      enabled: entity.enabled,
      platforms: entity.platforms,
      accountIds: entity.accountIds,
      keywordsAny: entity.keywordsAny,
      keywordsAll: entity.keywordsAll,
      keywordsNone: entity.keywordsNone,
      replyTemplate: entity.replyTemplate,
      replyDelaySec: entity.replyDelaySec,
      maxRepliesPerDay: entity.maxRepliesPerDay,
      repliesToday: entity.repliesToday,
      matchCount: entity.matchCount,
      replyCount: entity.replyCount,
      lastResetAt: entity.lastResetAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    })
  }
}

export class AutoReplyRuleListVo extends createPaginationVo(AutoReplyRuleVoSchema, 'AutoReplyRuleListVo') {}
