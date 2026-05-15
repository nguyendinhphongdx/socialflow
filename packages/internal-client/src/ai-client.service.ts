import { Inject, Injectable } from '@nestjs/common'
import type { AxiosInstance } from 'axios'
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
    const response = await this.http.post<{ data: GenerateCaptionOutput }>(
      '/internal/ai/caption',
      input,
      { headers: this.traceHeaders() },
    )
    return response.data.data
  }

  async generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
    const response = await this.http.post<{ data: GenerateImageOutput }>(
      '/internal/ai/image',
      input,
      { headers: this.traceHeaders() },
    )
    return response.data.data
  }

  private traceHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.ctx.traceId) headers['X-Trace-Id'] = this.ctx.traceId
    if (this.ctx.userId) headers['X-User-Id'] = this.ctx.userId
    return headers
  }
}
