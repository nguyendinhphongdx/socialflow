import { Inject, Injectable, Logger } from '@nestjs/common'
import type { AiCredential, AiProvider } from '@prisma/client'
import { AppException, ResponseCode } from '@sociflow/common'
import { decrypt, encrypt } from '@sociflow/common/crypto'
import { RequestContextService } from '@sociflow/auth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { AiCredentialRepository } from './ai-credential.repository'
import { AiCredentialResolver } from './ai-credential-resolver'
import { SUPPORTED_AI_PROVIDERS, maskSecret } from './credential.constants'
import type { CreateAiCredentialDto, UpdateAiCredentialDto } from './credential.dto'
import type { AiCredentialStatusRow } from './credential.vo'

@Injectable()
export class AiCredentialService {
  private readonly logger = new Logger(AiCredentialService.name)

  constructor(
    private readonly repo: AiCredentialRepository,
    private readonly resolver: AiCredentialResolver,
    private readonly ctx: RequestContextService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ============================================
  // WORKSPACE scope
  // ============================================

  async listForCurrentWorkspace(): Promise<AiCredential[]> {
    const workspaceId = this.ctx.requireWorkspaceId()
    return this.repo.listByWorkspaceId(workspaceId)
  }

  async getById(id: string): Promise<AiCredential> {
    const workspaceId = this.ctx.requireWorkspaceId()
    const entity = await this.repo.getById(id)
    if (!entity) throw new AppException(ResponseCode.AiCredentialNotFound, { id })
    if (entity.scope !== 'WORKSPACE' || entity.workspaceId !== workspaceId) {
      throw new AppException(ResponseCode.CredentialAccessDenied, { id })
    }
    return entity
  }

  async getStatusForCurrentWorkspace(): Promise<AiCredentialStatusRow[]> {
    const workspaceId = this.ctx.requireWorkspaceId()
    const rows: AiCredentialStatusRow[] = []
    for (const provider of SUPPORTED_AI_PROVIDERS) {
      const desc = await this.resolver.describe(provider, workspaceId)
      rows.push({
        provider: desc.provider,
        source: desc.source,
        credentialId: desc.credentialId,
        apiKeyMasked: desc.credentialId ? '***' : null,
        model: desc.model,
        isActive: desc.isActive,
        monthlyBudgetUsd: desc.monthlyBudgetUsd,
        monthSpentUsd: desc.monthSpentUsd,
        notes: desc.notes,
        updatedAt: desc.updatedAt,
      })
    }
    return rows
  }

  async createOrUpsert(dto: CreateAiCredentialDto): Promise<AiCredential> {
    const workspaceId = this.ctx.requireWorkspaceId()
    const userId = this.ctx.requireUserId()

    const existing = await this.repo.findByScope('WORKSPACE', workspaceId, dto.provider)
    const encryptedKey = encrypt(dto.apiKey, this.config.encryption.key)

    if (existing) {
      this.logger.log(`Workspace ${workspaceId} overwriting AI credential ${dto.provider}`)
      return this.repo.updateById(existing.id, {
        apiKey: encryptedKey,
        baseUrl: dto.baseUrl ?? null,
        model: dto.model ?? null,
        monthlyBudgetUsd: dto.monthlyBudgetUsd ?? null,
        notes: dto.notes ?? null,
        isActive: dto.isActive,
      })
    }

    return this.repo.create({
      scope: 'WORKSPACE',
      workspaceId,
      provider: dto.provider,
      apiKey: encryptedKey,
      baseUrl: dto.baseUrl ?? null,
      model: dto.model ?? null,
      monthlyBudgetUsd: dto.monthlyBudgetUsd ?? null,
      notes: dto.notes ?? null,
      isActive: dto.isActive,
      createdBy: userId,
    })
  }

  async updateById(id: string, dto: UpdateAiCredentialDto): Promise<AiCredential> {
    const existing = await this.getById(id)
    return this.repo.updateById(existing.id, {
      ...(dto.apiKey !== undefined && { apiKey: encrypt(dto.apiKey, this.config.encryption.key) }),
      ...(dto.baseUrl !== undefined && { baseUrl: dto.baseUrl }),
      ...(dto.model !== undefined && { model: dto.model }),
      ...(dto.monthlyBudgetUsd !== undefined && { monthlyBudgetUsd: dto.monthlyBudgetUsd }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    })
  }

  async deleteById(id: string): Promise<void> {
    const existing = await this.getById(id)
    await this.repo.deleteById(existing.id)
    this.logger.log(`Workspace ${existing.workspaceId} deleted AI credential ${existing.provider}`)
  }

  /**
   * Verify — decrypt + sanity check format. Không gọi provider thật vì sẽ
   * tốn quota của user.
   */
  async verify(id: string): Promise<{ ok: boolean, reason?: string }> {
    const entity = await this.getById(id)
    try {
      const decrypted = decrypt(entity.apiKey, this.config.encryption.key)
      if (!decrypted || decrypted.length < 8) {
        return { ok: false, reason: 'decrypt_empty_key' }
      }
      return { ok: true }
    }
    catch (err) {
      this.logger.warn(`Verify failed for AI credential ${id}: ${(err as Error).message}`)
      return { ok: false, reason: 'verify_failed' }
    }
  }

  // ============================================
  // SYSTEM scope (admin)
  // ============================================

  async listSystem(): Promise<AiCredential[]> {
    return this.repo.listSystem()
  }

  async upsertSystem(provider: AiProvider, dto: CreateAiCredentialDto): Promise<AiCredential> {
    const userId = this.ctx.requireUserId()
    const existing = await this.repo.findByScope('SYSTEM', null, provider)
    const encryptedKey = encrypt(dto.apiKey, this.config.encryption.key)

    if (existing) {
      return this.repo.updateById(existing.id, {
        apiKey: encryptedKey,
        baseUrl: dto.baseUrl ?? null,
        model: dto.model ?? null,
        monthlyBudgetUsd: dto.monthlyBudgetUsd ?? null,
        notes: dto.notes ?? null,
        isActive: dto.isActive,
      })
    }

    return this.repo.create({
      scope: 'SYSTEM',
      workspaceId: null,
      provider,
      apiKey: encryptedKey,
      baseUrl: dto.baseUrl ?? null,
      model: dto.model ?? null,
      monthlyBudgetUsd: dto.monthlyBudgetUsd ?? null,
      notes: dto.notes ?? null,
      isActive: dto.isActive,
      createdBy: userId,
    })
  }

  async deleteSystemById(id: string): Promise<void> {
    const entity = await this.repo.getById(id)
    if (!entity) throw new AppException(ResponseCode.AiCredentialNotFound, { id })
    if (entity.scope !== 'SYSTEM') throw new AppException(ResponseCode.CredentialAccessDenied, { id })
    await this.repo.deleteById(id)
  }

  // ============================================
  // Budget & VO helpers
  // ============================================

  /**
   * Pass-through to resolver — service layer entrypoint cho AiService gọi.
   */
  async incrementSpent(credentialId: string, amountUsd: number): Promise<void> {
    return this.resolver.incrementSpent(credentialId, amountUsd)
  }

  decryptAndMask(entity: AiCredential): string {
    try {
      const plain = decrypt(entity.apiKey, this.config.encryption.key)
      return maskSecret(plain)
    }
    catch {
      return '***'
    }
  }
}
