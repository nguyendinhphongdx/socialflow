import { z } from 'zod'
import { createZodDto } from '@sociflow/common'

/* ============================================================
 * Caption generation
 * ============================================================ */

export const GenerateCaptionPlatform = z.enum([
  'YOUTUBE',
  'FACEBOOK',
  'INSTAGRAM',
  'TIKTOK',
])

export const GenerateCaptionTone = z.enum([
  'professional',
  'casual',
  'funny',
])

// ADR-0010 BYOK — credential forwarded từ apps/api (resolved workspace credential).
const AiCredentialPayloadSchema = z.object({
  provider: z.enum(['OPENAI', 'ANTHROPIC', 'GOOGLE_GEMINI']),
  apiKey: z.string(),                       // empty = fallback env
  baseUrl: z.string().nullish(),
  model: z.string().nullish(),
}).strict()

export const GenerateCaptionDtoSchema = z.object({
  topic: z.string().min(1).max(500)
    .describe('Chủ đề / brief muốn AI viết caption'),
  platform: GenerateCaptionPlatform
    .describe('Platform đích — ảnh hưởng style + length'),
  tone: GenerateCaptionTone.default('casual')
    .describe('Tone of voice'),
  languageCode: z.string().min(2).max(10).default('vi')
    .describe('Mã ngôn ngữ đầu ra (ISO 639-1)'),
  maxLength: z.coerce.number().int().positive().max(2000).default(500)
    .describe('Độ dài tối đa (chars)'),
  includeHashtags: z.coerce.boolean().default(true)
    .describe('Có sinh kèm hashtag hay không'),
  providerId: z.enum(['openai', 'anthropic']).optional()
    .describe('Override default text provider'),
  credential: AiCredentialPayloadSchema.optional()
    .describe('BYOK credential (ADR-0010) — apps/api resolve và forward xuống đây'),
}).strict()

export class GenerateCaptionDto extends createZodDto(GenerateCaptionDtoSchema, 'GenerateCaptionDto') {}

/* ============================================================
 * Image generation
 * ============================================================ */

export const GenerateImageSize = z.enum(['1024x1024', '1792x1024', '1024x1792'])
export const GenerateImageQuality = z.enum(['standard', 'hd'])
export const GenerateImageStyle = z.enum(['vivid', 'natural'])

export const GenerateImageDtoSchema = z.object({
  prompt: z.string().min(1).max(4000)
    .describe('Prompt mô tả ảnh muốn sinh'),
  size: GenerateImageSize.default('1024x1024')
    .describe('Kích thước ảnh'),
  quality: GenerateImageQuality.default('standard')
    .describe('Chất lượng (standard rẻ hơn, hd chậm hơn)'),
  style: GenerateImageStyle.default('vivid')
    .describe('Style (vivid: rực rỡ, natural: tự nhiên)'),
  providerId: z.enum(['openai']).optional()
    .describe('Override default image provider'),
  credential: AiCredentialPayloadSchema.optional()
    .describe('BYOK credential (ADR-0010)'),
}).strict()

export class GenerateImageDto extends createZodDto(GenerateImageDtoSchema, 'GenerateImageDto') {}

/* ============================================================
 * VO schemas (for swagger response)
 * ============================================================ */

export const GenerateCaptionVoSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  model: z.string(),
  tokensUsed: z.number().int().nonnegative().optional(),
})

export class GenerateCaptionVo extends createZodDto(GenerateCaptionVoSchema, 'GenerateCaptionVo') {}

export const GenerateImageVoSchema = z.object({
  imageUrl: z.string().url(),
  revisedPrompt: z.string().optional(),
  model: z.string(),
})

export class GenerateImageVo extends createZodDto(GenerateImageVoSchema, 'GenerateImageVo') {}
