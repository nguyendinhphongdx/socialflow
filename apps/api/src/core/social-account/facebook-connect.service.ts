import { Inject, Injectable, Logger } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import {
  createFacebookProviderConfig,
  exchangeForLongLivedUserToken,
  fetchFacebookPages,
  OAuthService,
  type OAuthProviderConfig,
} from '@sociflow/oauth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { SocialAccountService } from './social-account.service'
import { WorkspaceService } from '../workspace/workspace.service'

interface ConnectResult {
  accountIds: string[]
  pageCount: number
  returnUrl: string | null
}

@Injectable()
export class FacebookConnectService {
  private readonly logger = new Logger(FacebookConnectService.name)
  private readonly provider: OAuthProviderConfig

  constructor(
    private readonly oauth: OAuthService,
    private readonly accountService: SocialAccountService,
    private readonly workspaceService: WorkspaceService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.provider = createFacebookProviderConfig({
      clientId: config.oauth.facebook.clientId,
      clientSecret: config.oauth.facebook.clientSecret,
    })
  }

  async buildAuthorizeUrl(userId: string, opts?: { returnUrl?: string, groupId?: string }) {
    return this.oauth.buildAuthorizeUrl({
      provider: this.provider,
      intent: 'CONNECT_ACCOUNT',
      userId,
      redirectUri: this.config.oauth.facebook.redirectUri,
      metadata: opts,
    })
  }

  /**
   * Callback handler: code → user token → long-lived → list pages → save 1 SocialAccount/page.
   *
   * Lưu ý: 1 user FB có thể manage nhiều pages → tạo nhiều SocialAccount (1/page).
   */
  async handleCallback(code: string, state: string): Promise<ConnectResult> {
    const { tokens, intent, userId, metadata } = await this.oauth.exchangeCode({
      provider: this.provider,
      state,
      code,
    })

    if (intent !== 'CONNECT_ACCOUNT' || !userId) {
      throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'unexpected_intent' })
    }

    // Exchange short-lived → long-lived user token
    const longLived = await exchangeForLongLivedUserToken(
      tokens.accessToken,
      this.provider.clientId,
      this.provider.clientSecret,
    )

    const pages = await fetchFacebookPages(longLived.accessToken)
    if (pages.length === 0) {
      throw new AppException(ResponseCode.AccountOAuthFailed, {
        provider: 'facebook',
        reason: 'no_pages_managed',
      })
    }

    // F-716 — workspaceId từ metadata, fallback personal workspace.
    const workspaceId = (typeof metadata?.workspaceId === 'string' && metadata.workspaceId)
      || (await this.workspaceService.resolvePersonalWorkspaceId(userId))
    if (!workspaceId) {
      throw new AppException(ResponseCode.WorkspaceAccessDenied)
    }

    const accountIds: string[] = []
    for (const page of pages) {
      const account = await this.accountService.saveOAuthTokens({
        userId,
        workspaceId,
        platform: 'FACEBOOK',
        platformUid: page.platformUid,
        displayName: page.displayName,
        avatarUrl: page.avatarUrl,
        accessToken: page.pageAccessToken,
        refreshToken: undefined,                              // page token không có refresh, dùng lâu (60d)
        expiresIn: longLived.expiresIn,
        scopes: this.provider.scopes,
        metadata: page.metadata,
        groupId: typeof metadata?.groupId === 'string' ? metadata.groupId : undefined,
      })
      accountIds.push(account.id)
    }

    this.logger.log(`Connected ${accountIds.length} Facebook pages cho user ${userId}`)
    return {
      accountIds,
      pageCount: accountIds.length,
      returnUrl: typeof metadata?.returnUrl === 'string' ? metadata.returnUrl : null,
    }
  }

  getProviderConfig(): OAuthProviderConfig {
    return this.provider
  }
}
