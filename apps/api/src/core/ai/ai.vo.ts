import { z } from 'zod'
import { createZodDto } from '@sociflow/common'

export const GenerateCaptionVoSchema = z.object({
  caption: z.string().describe('Caption đã sinh'),
  hashtags: z.array(z.string()).describe('Danh sách hashtag (không bao gồm #)'),
  model: z.string().describe('Model AI đã dùng'),
  tokensUsed: z.number().int().nullable().describe('Số token tiêu thụ (nếu provider trả về)'),
  creditsRemaining: z.number().int().describe('Số AI credit còn lại của user'),
})

export interface GenerateCaptionVoInput {
  caption: string
  hashtags: string[]
  model: string
  tokensUsed?: number
  creditsRemaining: number
}

export class GenerateCaptionVo extends createZodDto(GenerateCaptionVoSchema, 'GenerateCaptionVo') {
  static create(input: GenerateCaptionVoInput) {
    return GenerateCaptionVoSchema.parse({
      caption: input.caption,
      hashtags: input.hashtags,
      model: input.model,
      tokensUsed: input.tokensUsed ?? null,
      creditsRemaining: input.creditsRemaining,
    })
  }
}
