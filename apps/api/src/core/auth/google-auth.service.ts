import { Inject, Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { randomBytes } from 'node:crypto'
import { AppException, ResponseCode } from '@sociflow/common'
import { RequestContextService, SessionRepository, type JwtPayload } from '@sociflow/auth'
import {
  createGoogleProviderConfig,
  fetchGoogleProfile,
  OAuthService,
  type OAuthProviderConfig,
} from '@sociflow/oauth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { UserRepository } from '../user/user.repository'
import { WorkspaceService } from '../workspace/workspace.service'

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name)
  private readonly googleProvider: OAuthProviderConfig

  constructor(
    private readonly userRepo: UserRepository,
    private readonly sessionRepo: SessionRepository,
    private readonly oauth: OAuthService,
    private readonly jwt: JwtService,
    private readonly ctx: RequestContextService,
    private readonly workspaceService: WorkspaceService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.googleProvider = createGoogleProviderConfig({
      clientId: config.oauth.google.clientId,
      clientSecret: config.oauth.google.clientSecret,
    })
  }

  async buildAuthorizeUrl(returnUrl?: string): Promise<string> {
    return this.oauth.buildAuthorizeUrl({
      provider: this.googleProvider,
      intent: 'LOGIN',
      userId: null,
      redirectUri: this.config.oauth.google.redirectUri,
      metadata: returnUrl ? { returnUrl } : undefined,
    })
  }

  async handleCallback(code: string, state: string) {
    const { tokens, metadata } = await this.oauth.exchangeCode({
      provider: this.googleProvider,
      state,
      code,
    })

    const profile = await fetchGoogleProfile(tokens.accessToken)
    if (!profile.email) {
      throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'no_email' })
    }
    if (profile.emailVerified === false) {
      throw new AppException(ResponseCode.AccountOAuthFailed, { reason: 'email_not_verified' })
    }

    const user = await this.upsertUser(profile.email, profile.name ?? null, profile.avatarUrl ?? null)
    // F-716 — đảm bảo user có personal workspace + include trong token.
    const workspace = await this.workspaceService.ensurePersonalWorkspace(user.id, user.name)
    const sessionTokens = await this.issueTokens(user.id, user.email, user.role, workspace.id)
    return {
      user,
      tokens: sessionTokens,
      returnUrl: typeof metadata?.returnUrl === 'string' ? metadata.returnUrl : null,
    }
  }

  private async upsertUser(email: string, name: string | null, avatarUrl: string | null) {
    const existing = await this.userRepo.getByEmail(email)
    if (existing) {
      if (existing.avatarUrl !== avatarUrl || existing.name !== name) {
        return this.userRepo.updateById(existing.id, {
          avatarUrl: avatarUrl ?? existing.avatarUrl,
          name: name ?? existing.name,
          emailVerified: true,
        })
      }
      if (!existing.emailVerified) {
        return this.userRepo.updateById(existing.id, { emailVerified: true })
      }
      return existing
    }
    return this.userRepo.create({
      email,
      name,
      avatarUrl,
      emailVerified: true,
    })
  }

  private async issueTokens(userId: string, email: string, role: 'USER' | 'ADMIN', workspaceId?: string) {
    const refreshToken = randomBytes(48).toString('base64url')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const session = await this.sessionRepo.create({
      userId,
      refreshToken,
      expiresAt,
      userAgent: this.ctx.userAgent,
      ipAddress: this.ctx.ip,
    })

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      role,
      sessionId: session.id,
      workspaceId,
    }

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.auth.jwtAccessSecret,
      expiresIn: this.config.auth.jwtAccessExpiration as unknown as number,
    })
    const signedRefresh = await this.jwt.signAsync(payload, {
      secret: this.config.auth.jwtRefreshSecret,
      expiresIn: this.config.auth.jwtRefreshExpiration as unknown as number,
    })

    return {
      accessToken,
      refreshToken: signedRefresh,
      expiresIn: 15 * 60,
    }
  }
}
