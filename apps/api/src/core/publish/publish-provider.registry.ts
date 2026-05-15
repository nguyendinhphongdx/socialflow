import { Injectable } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import { YouTubeProvider } from './providers/youtube.provider'
import { FacebookProvider } from './providers/facebook.provider'
import type { PublishProvider } from './providers/publish-provider.interface'

@Injectable()
export class PublishProviderRegistry {
  private readonly providers = new Map<PublishProvider['platform'], PublishProvider>()

  constructor(youtube: YouTubeProvider, facebook: FacebookProvider) {
    this.providers.set(youtube.platform, youtube)
    this.providers.set(facebook.platform, facebook)
    // Phase 2 cont: instagram, tiktok
  }

  get(platform: PublishProvider['platform']): PublishProvider {
    const provider = this.providers.get(platform)
    if (!provider) {
      throw new AppException(ResponseCode.PublishTaskInvalid, {
        reason: 'no_provider_for_platform',
        platform,
      })
    }
    return provider
  }
}
