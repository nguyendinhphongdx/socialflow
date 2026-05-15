import { Inject, Injectable, Logger } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import {
  createTikTokProviderConfig,
  fetchTikTokUser,
  OAuthService,
  type OAuthProviderConfig,
} from '@sociflow/oauth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { SocialAccountService } from './social-account.service'

@Injectable()
export class TikTokConnectService {
  private readonly logger = new Logger(TikTokConnectService.name)
  private readonly provider: OAuthProviderConfig

  constructor(
    private readonly oauth: OAuthService,
    private readonly accountService: SocialAccountService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.provider = createTikTokProviderConfig({
      clientId: config.oauth.tiktok.clientKey,
      clientSecret: config.oauth.tiktok.clientSecret,
    })
  }

  async buildAuthorizeUrl(userId: string, opts?: { returnUrl?: string, groupId?: string }) {
    return this.oauth.buildAuthorizeUrl({
      provider: this.provider,
      intent: 'CONNECT_ACCOUNT',
      userId,
      redirectUri: this.config.oauth.tiktok.redirectUri,
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

    const user = await fetchTikTokUser(tokens.accessToken)

    const account = await this.accountService.saveOAuthTokens({
      userId,
      platform: 'TIKTOK',
      platformUid: user.platformUid,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      scopes: tokens.scope?.split(',') ?? this.provider.scopes,
      metadata: user.metadata,
      groupId: typeof metadata?.groupId === 'string' ? metadata.groupId : undefined,
    })

    this.logger.log(`Connected TikTok account ${account.id} cho user ${userId}`)
    return {
      account,
      returnUrl: typeof metadata?.returnUrl === 'string' ? metadata.returnUrl : null,
    }
  }

  async refreshAccessToken(accountId: string, refreshToken: string) {
    const newTokens = await this.oauth.refreshAccessToken(this.provider, refreshToken)
    return this.accountService.updateTokens(
      accountId,
      newTokens.accessToken,
      newTokens.refreshToken,
      newTokens.expiresIn,
    )
  }

  getProviderConfig(): OAuthProviderConfig {
    return this.provider
  }
}
