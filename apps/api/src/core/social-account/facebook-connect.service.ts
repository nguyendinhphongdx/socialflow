import { Injectable, Logger } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import {
  createFacebookProviderConfig,
  exchangeForLongLivedUserToken,
  fetchFacebookPages,
  OAuthService,
  OAuthStateRepository,
  type OAuthProviderConfig,
} from '@sociflow/oauth'
import { OAuthCredentialResolver } from '../credential/oauth-credential-resolver'
import { SocialAccountService } from './social-account.service'
import { WorkspaceService } from '../workspace/workspace.service'

interface ConnectResult {
  accountIds: string[]
  pageCount: number
  returnUrl: string | null
}

interface ResolvedFacebookContext {
  provider: OAuthProviderConfig
  redirectUri: string
}

@Injectable()
export class FacebookConnectService {
  private readonly logger = new Logger(FacebookConnectService.name)

  constructor(
    private readonly oauth: OAuthService,
    private readonly stateRepo: OAuthStateRepository,
    private readonly accountService: SocialAccountService,
    private readonly workspaceService: WorkspaceService,
    private readonly resolver: OAuthCredentialResolver,
    private readonly ctx: RequestContextService,
  ) {}

  async buildAuthorizeUrl(userId: string, opts?: { returnUrl?: string, groupId?: string, workspaceId?: string }) {
    const workspaceId = opts?.workspaceId ?? this.ctx.requireWorkspaceId()
    const { provider, redirectUri } = await this.resolveContext(workspaceId)
    return this.oauth.buildAuthorizeUrl({
      provider,
      intent: 'CONNECT_ACCOUNT',
      userId,
      redirectUri,
      metadata: { ...opts, workspaceId },
    })
  }

  async handleCallback(code: string, state: string): Promise<ConnectResult> {
    const stateRow = await this.stateRepo.getByState(state)
    if (!stateRow) throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'state_not_found' })
    const meta = (stateRow.metadata as Record<string, unknown> | null) ?? {}
    let workspaceId = typeof meta.workspaceId === 'string' ? meta.workspaceId : null
    if (!workspaceId && stateRow.userId) {
      workspaceId = await this.workspaceService.resolvePersonalWorkspaceId(stateRow.userId)
    }
    if (!workspaceId) {
      throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'no_workspace_context' })
    }
    const { provider } = await this.resolveContext(workspaceId)

    const { tokens, intent, userId, metadata } = await this.oauth.exchangeCode({
      provider,
      state,
      code,
    })

    if (intent !== 'CONNECT_ACCOUNT' || !userId) {
      throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'unexpected_intent' })
    }

    const longLived = await exchangeForLongLivedUserToken(
      tokens.accessToken,
      provider.clientId,
      provider.clientSecret,
    )

    const pages = await fetchFacebookPages(longLived.accessToken)
    if (pages.length === 0) {
      throw new AppException(ResponseCode.AccountOAuthFailed, {
        provider: 'facebook',
        reason: 'no_pages_managed',
      })
    }

    const resolvedWorkspaceId = (typeof metadata?.workspaceId === 'string' && metadata.workspaceId)
      || (await this.workspaceService.resolvePersonalWorkspaceId(userId))
    if (!resolvedWorkspaceId) {
      throw new AppException(ResponseCode.WorkspaceAccessDenied)
    }

    const accountIds: string[] = []
    for (const page of pages) {
      const account = await this.accountService.saveOAuthTokens({
        userId,
        workspaceId: resolvedWorkspaceId,
        platform: 'FACEBOOK',
        platformUid: page.platformUid,
        displayName: page.displayName,
        avatarUrl: page.avatarUrl,
        accessToken: page.pageAccessToken,
        refreshToken: undefined,
        expiresIn: longLived.expiresIn,
        scopes: provider.scopes,
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

  private async resolveContext(workspaceId: string): Promise<ResolvedFacebookContext> {
    const resolved = await this.resolver.resolve('FACEBOOK', workspaceId)
    const provider = createFacebookProviderConfig({
      clientId: resolved.clientId,
      clientSecret: resolved.clientSecret,
    })
    if (resolved.scopes) provider.scopes = resolved.scopes
    return { provider, redirectUri: resolved.redirectUri }
  }
}
