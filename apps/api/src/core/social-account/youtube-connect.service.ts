import { Inject, Injectable } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import {
  createYouTubeProviderConfig,
  fetchYouTubeChannel,
  OAuthService,
  type OAuthProviderConfig,
} from '@sociflow/oauth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { SocialAccountService } from './social-account.service'

@Injectable()
export class YouTubeConnectService {
  private readonly provider: OAuthProviderConfig

  constructor(
    private readonly oauth: OAuthService,
    private readonly accountService: SocialAccountService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.provider = createYouTubeProviderConfig({
      clientId: config.oauth.youtube.clientId,
      clientSecret: config.oauth.youtube.clientSecret,
    })
  }

  async buildAuthorizeUrl(userId: string, opts?: { returnUrl?: string, groupId?: string }) {
    return this.oauth.buildAuthorizeUrl({
      provider: this.provider,
      intent: 'CONNECT_ACCOUNT',
      userId,
      redirectUri: this.config.oauth.youtube.redirectUri,
      metadata: opts,
    })
  }

  async handleCallback(code: string, state: string) {
    const { tokens, intent, userId, metadata } = await this.oauth.exchangeCode({
      provider: this.provider,
      state,
      code,
    })

    if (intent !== 'CONNECT_ACCOUNT' || !userId) {
      throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'unexpected_intent' })
    }

    const channel = await fetchYouTubeChannel(tokens.accessToken)

    const account = await this.accountService.saveOAuthTokens({
      userId,
      platform: 'YOUTUBE',
      platformUid: channel.platformUid,
      displayName: channel.displayName,
      avatarUrl: channel.avatarUrl,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      scopes: tokens.scope?.split(' ') ?? this.provider.scopes,
      metadata: channel.metadata,
      groupId: typeof metadata?.groupId === 'string' ? metadata.groupId : undefined,
    })

    return {
      account,
      returnUrl: typeof metadata?.returnUrl === 'string' ? metadata.returnUrl : null,
    }
  }

  async refreshAccessToken(accountId: string, encryptedRefreshToken: string, decryptedRefreshToken: string) {
    const tokens = await this.oauth.refreshAccessToken(this.provider, decryptedRefreshToken)
    return this.accountService.updateTokens(
      accountId,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresIn,
    )
  }

  getProviderConfig(): OAuthProviderConfig {
    return this.provider
  }
}
