/**
 * Provider abstraction cho AI generation.
 *
 * - Mỗi provider implement chung 1 contract → registry pattern chọn theo `id`.
 * - `generateImage` optional (Anthropic không có image gen API tại thời điểm hiện tại).
 */
export interface AiProvider {
  readonly id: string
  generateText: (input: GenerateTextInput) => Promise<GenerateTextResult>
  generateImage?: (input: GenerateImageInput) => Promise<GenerateImageResult>
}

export interface GenerateTextInput {
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
}

export interface GenerateTextResult {
  text: string
  tokensUsed?: number
  model: string
}

export interface GenerateImageInput {
  prompt: string
  size?: '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
  style?: 'vivid' | 'natural'
}

export interface GenerateImageResult {
  imageUrl: string
  revisedPrompt?: string
  model: string
}

export const AI_PROVIDER_REGISTRY = 'AI_PROVIDER_REGISTRY'
