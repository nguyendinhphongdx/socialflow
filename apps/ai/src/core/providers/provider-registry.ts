import { Inject, Injectable } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import { APP_CONFIG, type AppConfig } from '../../config'
import { AnthropicProvider } from './anthropic.provider'
import { OpenAiProvider } from './openai.provider'
import type { AiProvider } from './ai-provider.interface'

/**
 * Registry pattern — chọn provider theo `id`.
 *
 * Default selection: `config.ai.defaults.{textProvider,imageProvider}`.
 * Service layer có thể override per-call qua param `providerId`.
 */
@Injectable()
export class ProviderRegistry {
  private readonly providers: Map<string, AiProvider>

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    openai: OpenAiProvider,
    anthropic: AnthropicProvider,
  ) {
    this.providers = new Map<string, AiProvider>([
      [openai.id, openai],
      [anthropic.id, anthropic],
    ])
  }

  getForText(id?: string): AiProvider {
    const resolved = id ?? this.config.ai.defaults.textProvider
    const provider = this.providers.get(resolved)
    if (!provider) {
      throw new AppException(ResponseCode.AiGenerationFailed, {
        reason: 'provider_not_found',
        providerId: resolved,
      })
    }
    return provider
  }

  getForImage(id?: string): AiProvider {
    const resolved = id ?? this.config.ai.defaults.imageProvider
    const provider = this.providers.get(resolved)
    if (!provider || !provider.generateImage) {
      throw new AppException(ResponseCode.AiGenerationFailed, {
        reason: 'image_provider_not_supported',
        providerId: resolved,
      })
    }
    return provider
  }

  /**
   * Map AiProvider enum (UPPERCASE) → provider id (lowercase) lookup.
   * Forward credential.provider từ apps/api caller chain (ADR-0010).
   */
  getByEnum(enumProvider: 'OPENAI' | 'ANTHROPIC' | 'GOOGLE_GEMINI'): AiProvider {
    const lower = enumProvider.toLowerCase() === 'google_gemini' ? 'gemini' : enumProvider.toLowerCase()
    const provider = this.providers.get(lower)
    if (!provider) {
      throw new AppException(ResponseCode.AiGenerationFailed, {
        reason: 'provider_not_found',
        providerId: enumProvider,
      })
    }
    return provider
  }
}
