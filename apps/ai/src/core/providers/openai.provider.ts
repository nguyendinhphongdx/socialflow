import { Inject, Injectable, Logger } from '@nestjs/common'
import OpenAI from 'openai'
import { AppException, ResponseCode } from '@sociflow/common'
import { APP_CONFIG, type AppConfig } from '../../config'
import type {
  AiProvider,
  GenerateImageInput,
  GenerateImageResult,
  GenerateTextInput,
  GenerateTextResult,
} from './ai-provider.interface'

@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly id = 'openai'

  private readonly logger = new Logger(OpenAiProvider.name)
  private readonly client: OpenAI | null
  private readonly textModel: string
  private readonly imageModel: string

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.textModel = config.ai.openai.textModel
    this.imageModel = config.ai.openai.imageModel
    this.client = config.ai.openai.apiKey
      ? new OpenAI({ apiKey: config.ai.openai.apiKey })
      : null
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const client = this.requireClient()

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    if (input.systemPrompt) {
      messages.push({ role: 'system', content: input.systemPrompt })
    }
    messages.push({ role: 'user', content: input.prompt })

    try {
      const completion = await client.chat.completions.create({
        model: this.textModel,
        messages,
        max_tokens: input.maxTokens,
        temperature: input.temperature ?? 0.7,
      })
      const text = completion.choices[0]?.message?.content?.trim() ?? ''
      if (!text) {
        throw new AppException(ResponseCode.AiGenerationFailed, {
          provider: this.id,
          reason: 'empty_response',
        })
      }
      return {
        text,
        tokensUsed: completion.usage?.total_tokens,
        model: completion.model,
      }
    }
    catch (err) {
      if (err instanceof AppException) throw err
      this.logger.error('openai generateText failed', err as Error)
      throw new AppException(ResponseCode.AiGenerationFailed, {
        provider: this.id,
        reason: 'sdk_error',
      })
    }
  }

  async generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
    const client = this.requireClient()

    try {
      const response = await client.images.generate({
        model: this.imageModel,
        prompt: input.prompt,
        size: input.size ?? '1024x1024',
        quality: input.quality ?? 'standard',
        style: input.style ?? 'vivid',
        n: 1,
      })
      const image = response.data?.[0]
      if (!image?.url) {
        throw new AppException(ResponseCode.AiGenerationFailed, {
          provider: this.id,
          reason: 'no_image_url',
        })
      }
      return {
        imageUrl: image.url,
        revisedPrompt: image.revised_prompt,
        model: this.imageModel,
      }
    }
    catch (err) {
      if (err instanceof AppException) throw err
      this.logger.error('openai generateImage failed', err as Error)
      throw new AppException(ResponseCode.AiGenerationFailed, {
        provider: this.id,
        reason: 'sdk_error',
      })
    }
  }

  private requireClient(): OpenAI {
    if (!this.client) {
      throw new AppException(ResponseCode.AiGenerationFailed, {
        provider: this.id,
        reason: 'api_key_missing',
      })
    }
    return this.client
  }
}
