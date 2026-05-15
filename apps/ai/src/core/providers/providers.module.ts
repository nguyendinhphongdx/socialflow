import { Global, Module } from '@nestjs/common'
import { AnthropicProvider } from './anthropic.provider'
import { OpenAiProvider } from './openai.provider'
import { ProviderRegistry } from './provider-registry'

/**
 * Global providers module — registry + concrete providers.
 *
 * Module khác chỉ cần inject `ProviderRegistry` rồi gọi `.getForText()` / `.getForImage()`.
 */
@Global()
@Module({
  providers: [OpenAiProvider, AnthropicProvider, ProviderRegistry],
  exports: [ProviderRegistry],
})
export class ProvidersModule {}
