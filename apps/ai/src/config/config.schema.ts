import { z } from 'zod'

/**
 * Root config schema cho apps/ai. Validate fail-fast qua zod.
 *
 * apps/ai chỉ là internal service — KHÔNG đụng DB, KHÔNG đụng auth user JWT.
 * Chỉ cần: provider keys + internal token + port.
 */
export const ConfigSchema = z.object({
  app: z.object({
    env: z.enum(['development', 'test', 'staging', 'production']),
    port: z.coerce.number().int().positive().default(3001),
  }),
  internal: z.object({
    token: z.string().min(16, 'INTERNAL_TOKEN phải ≥ 16 chars'),
  }),
  ai: z.object({
    openai: z.object({
      apiKey: z.string().optional().describe('OPENAI_API_KEY — bắt buộc khi default provider = openai'),
      textModel: z.string().default('gpt-4o-mini'),
      imageModel: z.string().default('dall-e-3'),
    }),
    anthropic: z.object({
      apiKey: z.string().optional().describe('ANTHROPIC_API_KEY — bắt buộc khi dùng anthropic provider'),
      textModel: z.string().default('claude-sonnet-4-6'),
    }),
    defaults: z.object({
      textProvider: z.enum(['openai', 'anthropic']).default('openai'),
      imageProvider: z.enum(['openai']).default('openai'),
    }),
  }),
})

export type AppConfig = z.infer<typeof ConfigSchema>
