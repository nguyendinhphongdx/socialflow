import { Inject, Injectable, Logger } from '@nestjs/common'
import type { AccountPlatform } from '@prisma/client'
import { AppException, ResponseCode } from '@sociflow/common'
import { decrypt } from '@sociflow/common/crypto'
import { APP_CONFIG, type AppConfig } from '../../config'
import { OAuthCredentialRepository } from './oauth-credential.repository'

/**
 * Resolved OAuth config — output của resolver, ready để construct provider client.
 */
export interface ResolvedOAuthConfig {
  platform: AccountPlatform
  clientId: string
  clientSecret: string                                // decrypted
  redirectUri: string
  scopes: string[] | null                              // null = dùng provider default
  source: 'WORKSPACE' | 'SYSTEM' | 'ENV'
  credentialId: string | null                          // null nếu source=ENV
}

/**
 * 3-layer fallback chain: WORKSPACE → SYSTEM → .env. Throw nếu cả 3 đều miss.
 *
 * Service connect (youtube/facebook/instagram/tiktok) inject resolver, gọi
 * `resolve(platform, workspaceId)` trước khi build provider config.
 */
@Injectable()
export class OAuthCredentialResolver {
  private readonly logger = new Logger(OAuthCredentialResolver.name)

  constructor(
    private readonly repo: OAuthCredentialRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async resolve(platform: AccountPlatform, workspaceId: string): Promise<ResolvedOAuthConfig> {
    // 1. Workspace BYOK
    const ws = await this.repo.findActiveByScope('WORKSPACE', workspaceId, platform)
    if (ws) {
      return this.mapEntity(platform, ws, 'WORKSPACE')
    }

    // 2. System default
    const sys = await this.repo.findActiveByScope('SYSTEM', null, platform)
    if (sys) {
      return this.mapEntity(platform, sys, 'SYSTEM')
    }

    // 3. .env fallback
    const envConfig = this.getEnvConfig(platform)
    if (envConfig) {
      return envConfig
    }

    throw new AppException(ResponseCode.OAuthCredentialNotConfigured, {
      platform,
      hint: 'Configure OAuth credential trong Workspace Settings → OAuth Credentials',
    })
  }

  /**
   * Resolve cho status endpoint — KHÔNG throw, KHÔNG decrypt secret. Trả info
   * source + redirectUri để UI hiển thị.
   */
  async describe(platform: AccountPlatform, workspaceId: string): Promise<{
    platform: AccountPlatform
    source: 'WORKSPACE' | 'SYSTEM' | 'ENV' | 'NONE'
    credentialId: string | null
    clientId: string | null
    redirectUri: string | null
    isActive: boolean
    notes: string | null
    updatedAt: Date | null
  }> {
    const ws = await this.repo.findByScope('WORKSPACE', workspaceId, platform)
    if (ws && ws.isActive) {
      return {
        platform,
        source: 'WORKSPACE',
        credentialId: ws.id,
        clientId: ws.clientId,
        redirectUri: ws.redirectUri,
        isActive: ws.isActive,
        notes: ws.notes,
        updatedAt: ws.updatedAt,
      }
    }

    const sys = await this.repo.findByScope('SYSTEM', null, platform)
    if (sys && sys.isActive) {
      return {
        platform,
        source: 'SYSTEM',
        credentialId: sys.id,
        clientId: sys.clientId,
        redirectUri: sys.redirectUri,
        isActive: sys.isActive,
        notes: sys.notes,
        updatedAt: sys.updatedAt,
      }
    }

    const envConfig = this.getEnvConfig(platform)
    if (envConfig) {
      return {
        platform,
        source: 'ENV',
        credentialId: null,
        clientId: envConfig.clientId,
        redirectUri: envConfig.redirectUri,
        isActive: true,
        notes: null,
        updatedAt: null,
      }
    }

    return {
      platform,
      source: 'NONE',
      credentialId: null,
      clientId: null,
      redirectUri: null,
      isActive: false,
      notes: null,
      updatedAt: null,
    }
  }

  private mapEntity(
    platform: AccountPlatform,
    entity: { id: string, clientId: string, clientSecret: string, redirectUri: string, scopes: string[] },
    source: 'WORKSPACE' | 'SYSTEM',
  ): ResolvedOAuthConfig {
    let plainSecret: string
    try {
      plainSecret = decrypt(entity.clientSecret, this.config.encryption.key)
    }
    catch (err) {
      this.logger.error(`Failed decrypt OAuthCredential ${entity.id}`, err as Error)
      throw new AppException(ResponseCode.OAuthCredentialInvalid, { credentialId: entity.id })
    }
    return {
      platform,
      clientId: entity.clientId,
      clientSecret: plainSecret,
      redirectUri: entity.redirectUri,
      scopes: entity.scopes.length > 0 ? entity.scopes : null,
      source,
      credentialId: entity.id,
    }
  }

  /**
   * Map AccountPlatform → env config nếu .env có giá trị non-default placeholder.
   * Placeholder pattern: "dev-xxx-client-id" — coi như chưa configure.
   */
  private getEnvConfig(platform: AccountPlatform): ResolvedOAuthConfig | null {
    switch (platform) {
      case 'YOUTUBE': {
        const o = this.config.oauth.youtube
        if (!o.clientId || o.clientId.startsWith('dev-')) return null
        return { platform, clientId: o.clientId, clientSecret: o.clientSecret, redirectUri: o.redirectUri, scopes: null, source: 'ENV', credentialId: null }
      }
      case 'FACEBOOK': {
        const o = this.config.oauth.facebook
        if (!o.clientId || o.clientId.startsWith('dev-')) return null
        return { platform, clientId: o.clientId, clientSecret: o.clientSecret, redirectUri: o.redirectUri, scopes: null, source: 'ENV', credentialId: null }
      }
      case 'INSTAGRAM': {
        const o = this.config.oauth.instagram
        if (!o.clientId || o.clientId.startsWith('dev-')) return null
        return { platform, clientId: o.clientId, clientSecret: o.clientSecret, redirectUri: o.redirectUri, scopes: null, source: 'ENV', credentialId: null }
      }
      case 'TIKTOK': {
        const o = this.config.oauth.tiktok
        if (!o.clientKey || o.clientKey.startsWith('dev-')) return null
        return { platform, clientId: o.clientKey, clientSecret: o.clientSecret, redirectUri: o.redirectUri, scopes: null, source: 'ENV', credentialId: null }
      }
      default:
        return null
    }
  }
}
