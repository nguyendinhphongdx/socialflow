import { z } from 'zod'
import { createZodDto } from '@sociflow/common'

export const GenerateCaptionDtoSchema = z.object({
  topic: z.string().min(3).max(500)
    .describe('Chủ đề / brief để sinh caption'),
  platform: z.enum(['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK'])
    .describe('Nền tảng đích — ảnh hưởng độ dài + style'),
  tone: z.enum(['professional', 'casual', 'funny']).optional()
    .describe('Tone giọng văn'),
  languageCode: z.string().min(2).max(10).optional()
    .describe('Mã ngôn ngữ (vd "vi", "en"). Mặc định: theo locale user'),
  maxLength: z.number().int().min(50).max(5000).optional()
    .describe('Độ dài tối đa caption (ký tự)'),
  includeHashtags: z.boolean().optional()
    .describe('Có thêm hashtag không'),
  providerId: z.enum(['openai', 'anthropic']).optional()
    .describe('Override provider AI (mặc định theo cấu hình server)'),
}).strict()

export class GenerateCaptionDto extends createZodDto(GenerateCaptionDtoSchema, 'GenerateCaptionDto') {}
