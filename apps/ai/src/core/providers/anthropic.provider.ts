import { Inject, Injectable, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { AppException, ResponseCode } from '@sociflow/common'
import { APP_CONFIG, type AppConfig } from '../../config'
import type {
  AiProvider,
  GenerateTextInput,
  GenerateTextResult,
} from './ai-provider.interface'

@Injectable()
export class AnthropicProvider implements AiProvider {
  readonly id = 'anthropic'

  private readonly logger = new Logger(AnthropicProvider.name)
  private readonly client: Anthropic | null
  private readonly textModel: string

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.textModel = config.ai.anthropic.textModel
    this.client = config.ai.anthropic.apiKey
      ? new Anthropic({ apiKey: config.ai.anthropic.apiKey })
      : null
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const client = this.requireClient()

    try {
      const message = await client.messages.create({
        model: this.textModel,
        max_tokens: input.maxTokens ?? 1024,
        temperature: input.temperature ?? 0.7,
        system: input.systemPrompt,
        messages: [{ role: 'user', content: input.prompt }],
      })

      const block = message.content.find((c): c is Anthropic.TextBlock => c.type === 'text')
      const text = block?.text?.trim() ?? ''
      if (!text) {
        throw new AppException(ResponseCode.AiGenerationFailed, {
          provider: this.id,
          reason: 'empty_response',
        })
      }
      return {
        text,
        tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
        model: message.model,
      }
    }
    catch (err) {
      if (err instanceof AppException) throw err
      this.logger.error('anthropic generateText failed', err as Error)
      throw new AppException(ResponseCode.AiGenerationFailed, {
        provider: this.id,
        reason: 'sdk_error',
      })
    }
  }

  private requireClient(): Anthropic {
    if (!this.client) {
      throw new AppException(ResponseCode.AiGenerationFailed, {
        provider: this.id,
        reason: 'api_key_missing',
      })
    }
    return this.client
  }
}
