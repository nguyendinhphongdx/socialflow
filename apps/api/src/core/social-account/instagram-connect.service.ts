import { Injectable, Logger } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import {
  createInstagramProviderConfig,
  exchangeForLongLivedUserToken,
  fetchInstagramAccounts,
  OAuthService,
  OAuthStateRepository,
  type OAuthProviderConfig,
} from '@sociflow/oauth'
import { OAuthCredentialResolver } from '../credential/oauth-credential-resolver'
import { SocialAccountService } from './social-account.service'
import { WorkspaceService } from '../workspace/workspace.service'

interface ConnectResult {
  accountIds: string[]
  count: number
  returnUrl: string | null
}

interface ResolvedInstagramContext {
  provider: OAuthProviderConfig
  redirectUri: string
}

@Injectable()
export class InstagramConnectService {
  private readonly logger = new Logger(InstagramConnectService.name)

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

    const igAccounts = await fetchInstagramAccounts(longLived.accessToken)

    const resolvedWorkspaceId = (typeof metadata?.workspaceId === 'string' && metadata.workspaceId)
      || (await this.workspaceService.resolvePersonalWorkspaceId(userId))
    if (!resolvedWorkspaceId) {
      throw new AppException(ResponseCode.WorkspaceAccessDenied)
    }

    const accountIds: string[] = []
    for (const ig of igAccounts) {
      const account = await this.accountService.saveOAuthTokens({
        userId,
        workspaceId: resolvedWorkspaceId,
        platform: 'INSTAGRAM',
        platformUid: ig.platformUid,
        displayName: ig.displayName,
        avatarUrl: ig.avatarUrl,
        accessToken: ig.pageAccessToken,
        refreshToken: undefined,
        expiresIn: longLived.expiresIn,
        scopes: provider.scopes,
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

  private async resolveContext(workspaceId: string): Promise<ResolvedInstagramContext> {
    const resolved = await this.resolver.resolve('INSTAGRAM', workspaceId)
    const provider = createInstagramProviderConfig({
      clientId: resolved.clientId,
      clientSecret: resolved.clientSecret,
    })
    if (resolved.scopes) provider.scopes = resolved.scopes
    return { provider, redirectUri: resolved.redirectUri }
  }
}
