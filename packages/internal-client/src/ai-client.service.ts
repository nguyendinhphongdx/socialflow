import { Inject, Injectable } from '@nestjs/common'
import type { AxiosInstance } from 'axios'
import { AppException, ResponseCode } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { createInternalClient } from './internal-client'

export const AI_CLIENT_OPTIONS = 'AI_CLIENT_OPTIONS'

export interface AiClientOptions {
  baseUrl: string                  // http://localhost:3001/api/v1
  internalToken: string
}

interface EchoResponse {
  echo: unknown
  receivedAt: number
  service: string
}

export interface GenerateCaptionInput {
  topic: string
  platform: 'YOUTUBE' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK'
  tone?: 'professional' | 'casual' | 'funny'
  languageCode?: string
  maxLength?: number
  includeHashtags?: boolean
  providerId?: 'openai' | 'anthropic'
}

export interface GenerateCaptionOutput {
  caption: string
  hashtags: string[]
  model: string
  tokensUsed?: number
}

export interface GenerateImageInput {
  prompt: string
  size?: '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
  style?: 'vivid' | 'natural'
  providerId?: 'openai'
}

export interface GenerateImageOutput {
  imageUrl: string
  revisedPrompt?: string
  model: string
}

export type SentimentLabel = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'

export interface ClassifySentimentInput {
  text: string
  languageCode?: string
  providerId?: 'openai' | 'anthropic'
}

export interface ClassifySentimentOutput {
  sentiment: SentimentLabel
  score: number
  model: string
}

/**
 * Typed client cho apps/ai endpoints. apps/api inject service này.
 *
 * Endpoints:
 * - `/internal/ai/echo`     — smoke test
 * - `/internal/ai/caption`  — sinh caption + hashtags
 * - `/internal/ai/image`    — sinh ảnh (DALL-E 3)
 */
@Injectable()
export class AiClientService {
  private readonly http: AxiosInstance

  constructor(
    @Inject(AI_CLIENT_OPTIONS) options: AiClientOptions,
    private readonly ctx: RequestContextService,
  ) {
    this.http = createInternalClient({
      baseUrl: options.baseUrl,
      internalToken: options.internalToken,
      serviceName: 'api',
    })
  }

  async echo(message: unknown): Promise<EchoResponse> {
    const response = await this.http.post<{ data: EchoResponse }>(
      '/internal/ai/echo',
      { message },
      { headers: this.traceHeaders() },
    )
    return response.data.data
  }

  async generateCaption(input: GenerateCaptionInput): Promise<GenerateCaptionOutput> {
    try {
      const response = await this.http.post<{ data: GenerateCaptionOutput }>(
        '/internal/ai/caption',
        input,
        { headers: this.traceHeaders() },
      )
      return response.data.data
    }
    catch (err) {
      // Envelope error (AppException) đã map qua internal-client interceptor — rethrow.
      if (err instanceof AppException) throw err
      // Network/5xx/timeout từ apps/ai → map sang AiGenerationFailed cho UX rõ ràng.
      throw new AppException(ResponseCode.AiGenerationFailed, { topic: input.topic })
    }
  }

  async generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
    try {
      const response = await this.http.post<{ data: GenerateImageOutput }>(
        '/internal/ai/image',
        input,
        { headers: this.traceHeaders() },
      )
      return response.data.data
    }
    catch (err) {
      if (err instanceof AppException) throw err
      throw new AppException(ResponseCode.AiGenerationFailed, { prompt: input.prompt })
    }
  }

  async classifySentiment(input: ClassifySentimentInput): Promise<ClassifySentimentOutput> {
    try {
      const response = await this.http.post<{ data: ClassifySentimentOutput }>(
        '/internal/ai/sentiment',
        input,
        { headers: this.traceHeaders() },
      )
      return response.data.data
    }
    catch (err) {
      if (err instanceof AppException) throw err
      throw new AppException(ResponseCode.BrandSentimentClassifyFailed, {
        textSample: input.text.slice(0, 80),
      })
    }
  }

  private traceHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.ctx.traceId) headers['X-Trace-Id'] = this.ctx.traceId
    if (this.ctx.userId) headers['X-User-Id'] = this.ctx.userId
    return headers
  }
}
