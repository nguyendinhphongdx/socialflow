import { Inject, Injectable, Logger } from '@nestjs/common'
import type { AccountPlatform, OAuthCredential } from '@prisma/client'
import { AppException, ResponseCode } from '@sociflow/common'
import { decrypt, encrypt } from '@sociflow/common/crypto'
import { RequestContextService } from '@sociflow/auth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { OAuthCredentialRepository } from './oauth-credential.repository'
import { OAuthCredentialResolver } from './oauth-credential-resolver'
import { SUPPORTED_OAUTH_PLATFORMS, maskSecret } from './credential.constants'
import type { CreateOAuthCredentialDto, UpdateOAuthCredentialDto } from './credential.dto'
import type { OAuthCredentialStatusRow } from './credential.vo'

@Injectable()
export class OAuthCredentialService {
  private readonly logger = new Logger(OAuthCredentialService.name)

  constructor(
    private readonly repo: OAuthCredentialRepository,
    private readonly resolver: OAuthCredentialResolver,
    private readonly ctx: RequestContextService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ============================================
  // WORKSPACE scope
  // ============================================

  async listForCurrentWorkspace(): Promise<OAuthCredential[]> {
    const workspaceId = this.ctx.requireWorkspaceId()
    return this.repo.listByWorkspaceId(workspaceId)
  }

  async getById(id: string): Promise<OAuthCredential> {
    const workspaceId = this.ctx.requireWorkspaceId()
    const entity = await this.repo.getById(id)
    if (!entity) throw new AppException(ResponseCode.OAuthCredentialNotFound, { id })
    if (entity.scope !== 'WORKSPACE' || entity.workspaceId !== workspaceId) {
      throw new AppException(ResponseCode.CredentialAccessDenied, { id })
    }
    return entity
  }

  /**
   * Status table — mỗi platform 1 row với source = WORKSPACE | SYSTEM | ENV | NONE.
   */
  async getStatusForCurrentWorkspace(): Promise<OAuthCredentialStatusRow[]> {
    const workspaceId = this.ctx.requireWorkspaceId()
    const rows: OAuthCredentialStatusRow[] = []
    for (const platform of SUPPORTED_OAUTH_PLATFORMS) {
      const desc = await this.resolver.describe(platform, workspaceId)
      rows.push(desc)
    }
    return rows
  }

  async createOrUpsert(dto: CreateOAuthCredentialDto): Promise<OAuthCredential> {
    const workspaceId = this.ctx.requireWorkspaceId()
    const userId = this.ctx.requireUserId()

    const existing = await this.repo.findByScope('WORKSPACE', workspaceId, dto.platform)
    const encryptedSecret = encrypt(dto.clientSecret, this.config.encryption.key)

    if (existing) {
      // Upsert behavior — overwrite
      this.logger.log(`Workspace ${workspaceId} overwriting OAuth credential ${dto.platform}`)
      return this.repo.updateById(existing.id, {
        clientId: dto.clientId,
        clientSecret: encryptedSecret,
        redirectUri: dto.redirectUri,
        scopes: dto.scopes ?? [],
        notes: dto.notes ?? null,
        isActive: dto.isActive,
      })
    }

    return this.repo.create({
      scope: 'WORKSPACE',
      workspaceId,
      platform: dto.platform,
      clientId: dto.clientId,
      clientSecret: encryptedSecret,
      redirectUri: dto.redirectUri,
      scopes: dto.scopes ?? [],
      notes: dto.notes ?? null,
      isActive: dto.isActive,
      createdBy: userId,
    })
  }

  async updateById(id: string, dto: UpdateOAuthCredentialDto): Promise<OAuthCredential> {
    const existing = await this.getById(id)
    return this.repo.updateById(existing.id, {
      ...(dto.clientId !== undefined && { clientId: dto.clientId }),
      ...(dto.clientSecret !== undefined && { clientSecret: encrypt(dto.clientSecret, this.config.encryption.key) }),
      ...(dto.redirectUri !== undefined && { redirectUri: dto.redirectUri }),
      ...(dto.scopes !== undefined && { scopes: dto.scopes }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    })
  }

  async deleteById(id: string): Promise<void> {
    const existing = await this.getById(id)
    await this.repo.deleteById(existing.id)
    this.logger.log(`Workspace ${existing.workspaceId} deleted OAuth credential ${existing.platform}`)
  }

  /**
   * Verify credential bằng dry-run OAuth init — decrypt secret, build provider
   * config, không gọi platform thật mà chỉ check format. Trả `ok=true` nếu
   * decrypt OK + redirectUri là URL hợp lệ.
   */
  async verify(id: string): Promise<{ ok: boolean, reason?: string }> {
    const entity = await this.getById(id)
    try {
      const decrypted = decrypt(entity.clientSecret, this.config.encryption.key)
      if (!decrypted || decrypted.length < 4) {
        return { ok: false, reason: 'decrypt_empty_secret' }
      }
      // eslint-disable-next-line no-new
      new URL(entity.redirectUri)
      return { ok: true }
    }
    catch (err) {
      this.logger.warn(`Verify failed for credential ${id}: ${(err as Error).message}`)
      return { ok: false, reason: 'verify_failed' }
    }
  }

  // ============================================
  // SYSTEM scope (admin)
  // ============================================

  async listSystem(): Promise<OAuthCredential[]> {
    return this.repo.listSystem()
  }

  async upsertSystem(platform: AccountPlatform, dto: CreateOAuthCredentialDto): Promise<OAuthCredential> {
    const userId = this.ctx.requireUserId()
    const existing = await this.repo.findByScope('SYSTEM', null, platform)
    const encryptedSecret = encrypt(dto.clientSecret, this.config.encryption.key)

    if (existing) {
      return this.repo.updateById(existing.id, {
        clientId: dto.clientId,
        clientSecret: encryptedSecret,
        redirectUri: dto.redirectUri,
        scopes: dto.scopes ?? [],
        notes: dto.notes ?? null,
        isActive: dto.isActive,
      })
    }

    return this.repo.create({
      scope: 'SYSTEM',
      workspaceId: null,
      platform,
      clientId: dto.clientId,
      clientSecret: encryptedSecret,
      redirectUri: dto.redirectUri,
      scopes: dto.scopes ?? [],
      notes: dto.notes ?? null,
      isActive: dto.isActive,
      createdBy: userId,
    })
  }

  async deleteSystemById(id: string): Promise<void> {
    const entity = await this.repo.getById(id)
    if (!entity) throw new AppException(ResponseCode.OAuthCredentialNotFound, { id })
    if (entity.scope !== 'SYSTEM') throw new AppException(ResponseCode.CredentialAccessDenied, { id })
    await this.repo.deleteById(id)
  }

  /**
   * Helper cho VO — return masked secret. Service chịu trách nhiệm decrypt-rồi-mask
   * vì repository không touch crypto.
   */
  decryptAndMask(entity: OAuthCredential): string {
    try {
      const plain = decrypt(entity.clientSecret, this.config.encryption.key)
      return maskSecret(plain)
    }
    catch {
      return '***'
    }
  }
}
