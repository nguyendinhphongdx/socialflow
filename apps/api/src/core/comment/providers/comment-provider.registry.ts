import { Injectable } from '@nestjs/common'
import type { AccountPlatform } from '@prisma/client'
import { AppException, ResponseCode } from '@sociflow/common'
import { FacebookCommentProvider } from './facebook-comment.provider'
import { InstagramCommentProvider } from './instagram-comment.provider'
import { YouTubeCommentProvider } from './youtube-comment.provider'
import { TikTokCommentProvider } from './tiktok-comment.provider'
import type { CommentReplyProvider } from './comment-provider.interface'

@Injectable()
export class CommentProviderRegistry {
  private readonly providers = new Map<AccountPlatform, CommentReplyProvider>()

  constructor(
    facebook: FacebookCommentProvider,
    instagram: InstagramCommentProvider,
    youtube: YouTubeCommentProvider,
    tiktok: TikTokCommentProvider,
  ) {
    this.providers.set(facebook.platform, facebook)
    this.providers.set(instagram.platform, instagram)
    this.providers.set(youtube.platform, youtube)
    this.providers.set(tiktok.platform, tiktok)
  }

  get(platform: AccountPlatform): CommentReplyProvider {
    const provider = this.providers.get(platform)
    if (!provider) {
      throw new AppException(ResponseCode.CommentReplyFailed, {
        reason: 'no_provider_for_platform',
        platform,
      })
    }
    return provider
  }
}
