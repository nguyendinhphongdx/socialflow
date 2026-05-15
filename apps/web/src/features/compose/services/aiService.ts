import { apiClient } from '@/lib/api/client'
import type { ApiResponse } from '@/lib/api/types'

export type AiPlatform = 'YOUTUBE' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK'

export interface GenerateCaptionInput {
  topic: string
  platform: AiPlatform
  tone?: 'professional' | 'casual' | 'funny'
  languageCode?: string
  maxLength?: number
  includeHashtags?: boolean
  providerId?: 'openai' | 'anthropic'
}

export interface GenerateCaptionResult {
  caption: string
  hashtags: string[]
  model: string
  tokensUsed: number | null
  creditsRemaining: number
}

export const aiService = {
  generateCaption: async (input: GenerateCaptionInput): Promise<GenerateCaptionResult> => {
    const { data } = await apiClient.post<ApiResponse<GenerateCaptionResult>>('/ai/caption', input)
    return data.data
  },
}
