import { Inject, Injectable, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { AppException, ResponseCode } from '@sociflow/common'
import { APP_CONFIG, type AppConfig } from '../../config'
import type {
  AiCredentialOverride,
  AiProvider,
  GenerateTextInput,
  GenerateTextResult,
} from './ai-provider.interface'

@Injectable()
export class AnthropicProvider implements AiProvider {
  readonly id = 'anthropic'

  private readonly logger = new Logger(AnthropicProvider.name)
  private readonly defaultClient: Anthropic | null
  private readonly defaultTextModel: string

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.defaultTextModel = config.ai.anthropic.textModel
    this.defaultClient = config.ai.anthropic.apiKey
      ? new Anthropic({ apiKey: config.ai.anthropic.apiKey })
      : null
  }

  async generateText(input: GenerateTextInput, credential?: AiCredentialOverride): Promise<GenerateTextResult> {
    const { client, model } = this.resolveClient(credential, this.defaultTextModel)

    try {
      const message = await client.messages.create({
        model,
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
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
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

  private resolveClient(
    credential: AiCredentialOverride | undefined,
    fallbackModel: string,
  ): { client: Anthropic, model: string } {
    if (credential?.apiKey) {
      const client = new Anthropic({
        apiKey: credential.apiKey,
        ...(credential.baseUrl && { baseURL: credential.baseUrl }),
      })
      return { client, model: credential.model ?? fallbackModel }
    }
    if (!this.defaultClient) {
      throw new AppException(ResponseCode.AiGenerationFailed, {
        provider: this.id,
        reason: 'api_key_missing',
      })
    }
    return { client: this.defaultClient, model: fallbackModel }
  }
}
