import { z } from 'zod'
import type { AutomationAgent } from '@prisma/client'
import { createPaginationVo, createZodDto } from '@sociflow/common'

export const AgentVoSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  type: z.enum(['EXTENSION', 'DESKTOP']),
  os: z.string().nullable(),
  browserName: z.string().nullable(),
  extensionVersion: z.string().nullable(),
  capabilities: z.array(z.string()),
  online: z.boolean(),
  lastSeenAt: z.date().nullable(),
  lastConnectedAt: z.date().nullable(),
  createdAt: z.date(),
  revokedAt: z.date().nullable(),
})

export class AgentVo extends createZodDto(AgentVoSchema, 'AgentVo') {
  /**
   * Map entity → VO. Strip `pairCode`, `agentTokenSha256` (sensitive).
   */
  static create(entity: AutomationAgent) {
    return AgentVoSchema.parse({
      id: entity.id,
      publicId: entity.publicId,
      type: entity.type,
      os: entity.os,
      browserName: entity.browserName,
      extensionVersion: entity.extensionVersion,
      capabilities: entity.capabilities,
      online: entity.online,
      lastSeenAt: entity.lastSeenAt,
      lastConnectedAt: entity.lastConnectedAt,
      createdAt: entity.createdAt,
      revokedAt: entity.revokedAt,
    })
  }
}

export class AgentListVo extends createPaginationVo(AgentVoSchema, 'AgentListVo') {}

/**
 * POST /agents/pair/init response.
 */
export const PairInitVoSchema = z.object({
  pairCode: z.string().regex(/^\d{6}$/),
  expiresAt: z.string().datetime(),
  agentPublicId: z.string(),
})

export class PairInitVo extends createZodDto(PairInitVoSchema, 'PairInitVo') {
  static create(input: { pairCode: string, expiresAt: Date, agentPublicId: string }) {
    return PairInitVoSchema.parse({
      pairCode: input.pairCode,
      expiresAt: input.expiresAt.toISOString(),
      agentPublicId: input.agentPublicId,
    })
  }
}

/**
 * POST /agents/pair/claim response. KHÔNG return qua VO.create (raw agentToken
 * chỉ tồn tại in-memory, sau khi response sẽ không bao giờ được trả về nữa).
 */
export const PairClaimVoSchema = z.object({
  agentId: z.string(),
  agentPublicId: z.string(),
  agentToken: z.string(),
  wsUrl: z.string().url(),
  userId: z.string(),
})

export class PairClaimVo extends createZodDto(PairClaimVoSchema, 'PairClaimVo') {
  static create(input: {
    agentId: string
    agentPublicId: string
    agentToken: string
    wsUrl: string
    userId: string
  }) {
    return PairClaimVoSchema.parse(input)
  }
}
