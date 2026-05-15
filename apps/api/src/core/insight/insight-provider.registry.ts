import { Injectable } from '@nestjs/common'
import type { AccountPlatform } from '@prisma/client'
import { AppException, ResponseCode } from '@sociflow/common'
import type { InsightProvider } from './providers/insight-provider.interface'
import { FacebookInsightProvider } from './providers/facebook-insight.provider'
import { YouTubeInsightProvider } from './providers/youtube-insight.provider'
import { InstagramInsightProvider } from './providers/instagram-insight.provider'
import { TikTokInsightProvider } from './providers/tiktok-insight.provider'

@Injectable()
export class InsightProviderRegistry {
  private readonly providers = new Map<AccountPlatform, InsightProvider>()

  constructor(
    facebook: FacebookInsightProvider,
    youtube: YouTubeInsightProvider,
    instagram: InstagramInsightProvider,
    tiktok: TikTokInsightProvider,
  ) {
    this.providers.set(facebook.platform, facebook)
    this.providers.set(youtube.platform, youtube)
    this.providers.set(instagram.platform, instagram)
    this.providers.set(tiktok.platform, tiktok)
  }

  get(platform: AccountPlatform): InsightProvider {
    const provider = this.providers.get(platform)
    if (!provider) {
      throw new AppException(ResponseCode.InsightFetchFailed, {
        reason: 'no_provider_for_platform',
        platform,
      })
    }
    return provider
  }
}
