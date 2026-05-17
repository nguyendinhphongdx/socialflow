import { z } from 'zod'
import { createZodDto } from '@sociflow/common'

const PlatformEnum = z.enum(['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK'])
const AiProviderEnum = z.enum(['OPENAI', 'ANTHROPIC', 'GOOGLE_GEMINI'])
const ScopeEnum = z.enum(['SYSTEM', 'WORKSPACE'])

// ============================================
// OAuth credentials
// ============================================

export const CreateOAuthCredentialDtoSchema = z.object({
  platform: PlatformEnum.describe('Nền tảng OAuth cần cấu hình'),
  clientId: z.string().min(1).max(500).describe('OAuth Client ID từ developer console'),
  clientSecret: z.string().min(1).max(500).describe('OAuth Client Secret — sẽ encrypt trước khi lưu'),
  redirectUri: z.string().url().max(500).describe('Redirect URI đã đăng ký trong platform dev console'),
  scopes: z.array(z.string().max(200)).max(50).optional()
    .describe('Override default OAuth scopes nếu cần'),
  notes: z.string().max(500).optional().describe('Audit hint, vd "Brand X agency app"'),
  isActive: z.boolean().default(true).describe('Bật/tắt credential mà không xoá'),
}).strict()

export class CreateOAuthCredentialDto extends createZodDto(CreateOAuthCredentialDtoSchema, 'CreateOAuthCredentialDto') {}

export const UpdateOAuthCredentialDtoSchema = CreateOAuthCredentialDtoSchema.partial().omit({ platform: true })

export class UpdateOAuthCredentialDto extends createZodDto(UpdateOAuthCredentialDtoSchema, 'UpdateOAuthCredentialDto') {}

// ============================================
// AI credentials
// ============================================

export const CreateAiCredentialDtoSchema = z.object({
  provider: AiProviderEnum.describe('AI provider'),
  apiKey: z.string().min(8).max(500).describe('API key — sẽ encrypt trước khi lưu'),
  baseUrl: z.string().url().max(500).optional()
    .describe('Custom proxy endpoint (vd Cloudflare AI gateway, OpenRouter)'),
  model: z.string().max(200).optional().describe('Override default model'),
  monthlyBudgetUsd: z.coerce.number().nonnegative().max(1_000_000).optional()
    .describe('Cap chi tiêu tháng (USD). Khi vượt → disable credential'),
  notes: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
}).strict()

export class CreateAiCredentialDto extends createZodDto(CreateAiCredentialDtoSchema, 'CreateAiCredentialDto') {}

export const UpdateAiCredentialDtoSchema = CreateAiCredentialDtoSchema.partial().omit({ provider: true })

export class UpdateAiCredentialDto extends createZodDto(UpdateAiCredentialDtoSchema, 'UpdateAiCredentialDto') {}

// ============================================
// Admin (SYSTEM scope) DTO
// ============================================

export const CreateSystemOAuthCredentialDtoSchema = CreateOAuthCredentialDtoSchema.extend({
  // SYSTEM scope không cần workspaceId
})

export class CreateSystemOAuthCredentialDto extends createZodDto(CreateSystemOAuthCredentialDtoSchema, 'CreateSystemOAuthCredentialDto') {}

export const CreateSystemAiCredentialDtoSchema = CreateAiCredentialDtoSchema.extend({})

export class CreateSystemAiCredentialDto extends createZodDto(CreateSystemAiCredentialDtoSchema, 'CreateSystemAiCredentialDto') {}

// ============================================
// Filter / common
// ============================================

export const CredentialStatusFilterDtoSchema = z.object({
  includeSystem: z.coerce.boolean().default(false)
    .describe('Có hiển thị system credential (admin-only) không'),
}).strict()

export class CredentialStatusFilterDto extends createZodDto(CredentialStatusFilterDtoSchema, 'CredentialStatusFilterDto') {}

export { PlatformEnum, AiProviderEnum, ScopeEnum }
