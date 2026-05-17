import { Inject, Injectable, Logger } from '@nestjs/common'
import OpenAI from 'openai'
import { AppException, ResponseCode } from '@sociflow/common'
import { APP_CONFIG, type AppConfig } from '../../config'
import type {
  AiCredentialOverride,
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
  private readonly defaultClient: OpenAI | null
  private readonly defaultTextModel: string
  private readonly defaultImageModel: string

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.defaultTextModel = config.ai.openai.textModel
    this.defaultImageModel = config.ai.openai.imageModel
    this.defaultClient = config.ai.openai.apiKey
      ? new OpenAI({ apiKey: config.ai.openai.apiKey })
      : null
  }

  async generateText(input: GenerateTextInput, credential?: AiCredentialOverride): Promise<GenerateTextResult> {
    const { client, model } = this.resolveClient(credential, this.defaultTextModel)

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    if (input.systemPrompt) {
      messages.push({ role: 'system', content: input.systemPrompt })
    }
    messages.push({ role: 'user', content: input.prompt })

    try {
      const completion = await client.chat.completions.create({
        model,
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
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
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

  async generateImage(input: GenerateImageInput, credential?: AiCredentialOverride): Promise<GenerateImageResult> {
    const { client, model } = this.resolveClient(credential, this.defaultImageModel)

    try {
      const response = await client.images.generate({
        model,
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
        model,
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

  /**
   * Resolve client per-call: BYOK credential (apiKey non-empty) → tạo client mới.
   * Fallback: defaultClient (env).
   */
  private resolveClient(
    credential: AiCredentialOverride | undefined,
    fallbackModel: string,
  ): { client: OpenAI, model: string } {
    if (credential?.apiKey) {
      const client = new OpenAI({
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
