import { Inject, Injectable, Logger } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import {
  createInstagramProviderConfig,
  exchangeForLongLivedUserToken,
  fetchInstagramAccounts,
  OAuthService,
  type OAuthProviderConfig,
} from '@sociflow/oauth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { SocialAccountService } from './social-account.service'
import { WorkspaceService } from '../workspace/workspace.service'

interface ConnectResult {
  accountIds: string[]
  count: number
  returnUrl: string | null
}

@Injectable()
export class InstagramConnectService {
  private readonly logger = new Logger(InstagramConnectService.name)
  private readonly provider: OAuthProviderConfig

  constructor(
    private readonly oauth: OAuthService,
    private readonly accountService: SocialAccountService,
    private readonly workspaceService: WorkspaceService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.provider = createInstagramProviderConfig({
      clientId: config.oauth.instagram.clientId,
      clientSecret: config.oauth.instagram.clientSecret,
    })
  }

  async buildAuthorizeUrl(userId: string, opts?: { returnUrl?: string, groupId?: string }) {
    return this.oauth.buildAuthorizeUrl({
      provider: this.provider,
      intent: 'CONNECT_ACCOUNT',
      userId,
      redirectUri: this.config.oauth.instagram.redirectUri,
      metadata: opts,
    })
  }

  async handleCallback(code: string, state: string): Promise<ConnectResult> {
    const { tokens, intent, userId, metadata } = await this.oauth.exchangeCode({
      provider: this.provider,
      state,
      code,
    })

    if (intent !== 'CONNECT_ACCOUNT' || !userId) {
      throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'unexpected_intent' })
    }

    const longLived = await exchangeForLongLivedUserToken(
      tokens.accessToken,
      this.provider.clientId,
      this.provider.clientSecret,
    )

    const igAccounts = await fetchInstagramAccounts(longLived.accessToken)

    // F-716 — workspaceId từ metadata, fallback personal workspace.
    const workspaceId = (typeof metadata?.workspaceId === 'string' && metadata.workspaceId)
      || (await this.workspaceService.resolvePersonalWorkspaceId(userId))
    if (!workspaceId) {
      throw new AppException(ResponseCode.WorkspaceAccessDenied)
    }

    const accountIds: string[] = []
    for (const ig of igAccounts) {
      const account = await this.accountService.saveOAuthTokens({
        userId,
        workspaceId,
        platform: 'INSTAGRAM',
        platformUid: ig.platformUid,
        displayName: ig.displayName,
        avatarUrl: ig.avatarUrl,
        accessToken: ig.pageAccessToken,                        // dùng page token cho IG Graph calls
        refreshToken: undefined,
        expiresIn: longLived.expiresIn,
        scopes: this.provider.scopes,
        metadata: ig.metadata,
        groupId: typeof metadata?.groupId === 'string' ? metadata.groupId : undefined,
      })
      accountIds.push(account.id)
    }

    this.logger.log(`Connected ${accountIds.length} Instagram accounts cho user ${userId}`)
    return {
      accountIds,
      count: accountIds.length,
      returnUrl: typeof metadata?.returnUrl === 'string' ? metadata.returnUrl : null,
    }
  }

  getProviderConfig(): OAuthProviderConfig {
    return this.provider
  }
}
