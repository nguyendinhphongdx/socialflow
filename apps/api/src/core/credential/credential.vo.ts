import { z } from 'zod'
import type { AccountPlatform, AiCredential, AiProvider, CredentialScope, OAuthCredential } from '@prisma/client'
import { createZodDto } from '@sociflow/common'
import { maskSecret } from './credential.constants'

const PlatformEnum = z.enum(['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK'])
const AiProviderEnum = z.enum(['OPENAI', 'ANTHROPIC', 'GOOGLE_GEMINI'])
const ScopeEnum = z.enum(['SYSTEM', 'WORKSPACE'])
const SourceEnum = z.enum(['WORKSPACE', 'SYSTEM', 'ENV', 'NONE'])

// ============================================
// OAuth credential VO
// ============================================

export const OAuthCredentialVoSchema = z.object({
  id: z.string().cuid(),
  scope: ScopeEnum,
  workspaceId: z.string().nullable(),
  platform: PlatformEnum,
  clientId: z.string(),
  clientSecretMasked: z.string(),
  redirectUri: z.string(),
  scopes: z.array(z.string()),
  isActive: z.boolean(),
  notes: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class OAuthCredentialVo extends createZodDto(OAuthCredentialVoSchema, 'OAuthCredentialVo') {
  static create(entity: OAuthCredential): OAuthCredentialVo {
    return OAuthCredentialVoSchema.parse({
      id: entity.id,
      scope: entity.scope,
      workspaceId: entity.workspaceId,
      platform: entity.platform,
      clientId: entity.clientId,
      clientSecretMasked: maskSecret(entity.clientId),    // clientId luôn lộ; secret mask
      redirectUri: entity.redirectUri,
      scopes: entity.scopes,
      isActive: entity.isActive,
      notes: entity.notes,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    })
  }
}

// ============================================
// OAuth status (per-platform table) — endpoint /oauth-credentials/status
// ============================================

export const OAuthCredentialStatusRowSchema = z.object({
  platform: PlatformEnum,
  source: SourceEnum.describe('WORKSPACE: workspace BYOK active. SYSTEM: admin global. ENV: .env fallback. NONE: chưa config'),
  credentialId: z.string().cuid().nullable().describe('null nếu source = ENV/NONE'),
  clientId: z.string().nullable(),
  redirectUri: z.string().nullable(),
  isActive: z.boolean(),
  notes: z.string().nullable(),
  updatedAt: z.date().nullable(),
})

export type OAuthCredentialStatusRow = z.infer<typeof OAuthCredentialStatusRowSchema>

export const OAuthCredentialStatusVoSchema = z.object({
  rows: z.array(OAuthCredentialStatusRowSchema),
})

export class OAuthCredentialStatusVo extends createZodDto(OAuthCredentialStatusVoSchema, 'OAuthCredentialStatusVo') {}

// ============================================
// OAuth verify result
// ============================================

export const OAuthVerifyVoSchema = z.object({
  ok: z.boolean(),
  authorizeUrl: z.string().url().optional(),
  reason: z.string().optional(),
})

export class OAuthVerifyVo extends createZodDto(OAuthVerifyVoSchema, 'OAuthVerifyVo') {}

// ============================================
// AI credential VO
// ============================================

export const AiCredentialVoSchema = z.object({
  id: z.string().cuid(),
  scope: ScopeEnum,
  workspaceId: z.string().nullable(),
  provider: AiProviderEnum,
  apiKeyMasked: z.string(),
  baseUrl: z.string().nullable(),
  model: z.string().nullable(),
  isActive: z.boolean(),
  monthlyBudgetUsd: z.number().nullable(),
  monthSpentUsd: z.number(),
  monthResetAt: z.date(),
  notes: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

interface AiCredentialWithMaskedKey extends AiCredential {
  apiKeyMasked: string
}

export class AiCredentialVo extends createZodDto(AiCredentialVoSchema, 'AiCredentialVo') {
  /**
   * @param entity Prisma entity với apiKey STILL encrypted (DB value)
   * @param maskedKey decrypted-then-masked string (service responsibility)
   */
  static create(entity: AiCredentialWithMaskedKey): AiCredentialVo {
    return AiCredentialVoSchema.parse({
      id: entity.id,
      scope: entity.scope,
      workspaceId: entity.workspaceId,
      provider: entity.provider,
      apiKeyMasked: entity.apiKeyMasked,
      baseUrl: entity.baseUrl,
      model: entity.model,
      isActive: entity.isActive,
      monthlyBudgetUsd: entity.monthlyBudgetUsd ? Number(entity.monthlyBudgetUsd) : null,
      monthSpentUsd: Number(entity.monthSpentUsd),
      monthResetAt: entity.monthResetAt,
      notes: entity.notes,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    })
  }
}

// ============================================
// AI status
// ============================================

export const AiCredentialStatusRowSchema = z.object({
  provider: AiProviderEnum,
  source: SourceEnum,
  credentialId: z.string().cuid().nullable(),
  apiKeyMasked: z.string().nullable(),
  model: z.string().nullable(),
  isActive: z.boolean(),
  monthlyBudgetUsd: z.number().nullable(),
  monthSpentUsd: z.number(),
  notes: z.string().nullable(),
  updatedAt: z.date().nullable(),
})

export type AiCredentialStatusRow = z.infer<typeof AiCredentialStatusRowSchema>

export const AiCredentialStatusVoSchema = z.object({
  rows: z.array(AiCredentialStatusRowSchema),
})

export class AiCredentialStatusVo extends createZodDto(AiCredentialStatusVoSchema, 'AiCredentialStatusVo') {}

export type { AccountPlatform, AiProvider, CredentialScope }
