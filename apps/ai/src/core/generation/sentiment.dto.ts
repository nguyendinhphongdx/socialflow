import { z } from 'zod'
import { createZodDto } from '@sociflow/common'

/**
 * Sentiment classification — phân loại text thành POSITIVE/NEGATIVE/NEUTRAL.
 * Dùng cho brand mention + (tuỳ chọn) comment moderation.
 */
export const SentimentLabel = z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL'])
export type SentimentLabelType = z.infer<typeof SentimentLabel>

const AiCredentialPayloadSchema = z.object({
  provider: z.enum(['OPENAI', 'ANTHROPIC', 'GOOGLE_GEMINI']),
  apiKey: z.string(),
  baseUrl: z.string().nullish(),
  model: z.string().nullish(),
}).strict()

export const ClassifySentimentDtoSchema = z.object({
  text: z.string().min(1).max(5000)
    .describe('Văn bản cần phân loại sentiment'),
  languageCode: z.string().min(2).max(10).default('vi')
    .describe('Mã ngôn ngữ đầu vào (ISO 639-1) — gợi ý LLM'),
  providerId: z.enum(['openai', 'anthropic']).optional()
    .describe('Override default text provider'),
  credential: AiCredentialPayloadSchema.optional()
    .describe('BYOK credential (ADR-0010)'),
}).strict()

export class ClassifySentimentDto extends createZodDto(ClassifySentimentDtoSchema, 'ClassifySentimentDto') {}

export const ClassifySentimentVoSchema = z.object({
  sentiment: SentimentLabel
    .describe('Nhãn sentiment'),
  score: z.number().min(0).max(1)
    .describe('Confidence score 0-1'),
  model: z.string()
    .describe('Model AI đã dùng'),
})

export class ClassifySentimentVo extends createZodDto(ClassifySentimentVoSchema, 'ClassifySentimentVo') {}
