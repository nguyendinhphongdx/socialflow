import { Injectable, Logger } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import {
  createTikTokProviderConfig,
  fetchTikTokUser,
  OAuthService,
  OAuthStateRepository,
  type OAuthProviderConfig,
} from '@sociflow/oauth'
import { OAuthCredentialResolver } from '../credential/oauth-credential-resolver'
import { SocialAccountService } from './social-account.service'
import { WorkspaceService } from '../workspace/workspace.service'

interface ResolvedTikTokContext {
  provider: OAuthProviderConfig
  redirectUri: string
}

@Injectable()
export class TikTokConnectService {
  private readonly logger = new Logger(TikTokConnectService.name)

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

  async handleCallback(code: string, state: string) {
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

    const user = await fetchTikTokUser(tokens.accessToken)

    const resolvedWorkspaceId = (typeof metadata?.workspaceId === 'string' && metadata.workspaceId)
      || (await this.workspaceService.resolvePersonalWorkspaceId(userId))
    if (!resolvedWorkspaceId) {
      throw new AppException(ResponseCode.WorkspaceAccessDenied)
    }

    const account = await this.accountService.saveOAuthTokens({
      userId,
      workspaceId: resolvedWorkspaceId,
      platform: 'TIKTOK',
      platformUid: user.platformUid,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      scopes: tokens.scope?.split(',') ?? provider.scopes,
      metadata: user.metadata,
      groupId: typeof metadata?.groupId === 'string' ? metadata.groupId : undefined,
    })

    this.logger.log(`Connected TikTok account ${account.id} cho user ${userId}`)
    return {
      account,
      returnUrl: typeof metadata?.returnUrl === 'string' ? metadata.returnUrl : null,
    }
  }

  async refreshAccessToken(accountId: string, refreshToken: string, workspaceId: string) {
    const { provider } = await this.resolveContext(workspaceId)
    const newTokens = await this.oauth.refreshAccessToken(provider, refreshToken)
    return this.accountService.updateTokens(
      accountId,
      newTokens.accessToken,
      newTokens.refreshToken,
      newTokens.expiresIn,
    )
  }

  private async resolveContext(workspaceId: string): Promise<ResolvedTikTokContext> {
    const resolved = await this.resolver.resolve('TIKTOK', workspaceId)
    const provider = createTikTokProviderConfig({
      clientId: resolved.clientId,
      clientSecret: resolved.clientSecret,
    })
    if (resolved.scopes) provider.scopes = resolved.scopes
    return { provider, redirectUri: resolved.redirectUri }
  }
}
