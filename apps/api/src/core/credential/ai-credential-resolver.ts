import { Inject, Injectable, Logger } from '@nestjs/common'
import type { AiCredential, AiProvider } from '@prisma/client'
import { AppException, ResponseCode } from '@sociflow/common'
import { decrypt } from '@sociflow/common/crypto'
import { APP_CONFIG, type AppConfig } from '../../config'
import { AiCredentialRepository } from './ai-credential.repository'

/**
 * Resolved AI config — output ready cho apps/ai consume.
 *
 * `credentialId = null` chỉ khi source = ENV. Khi != null, service caller
 * gọi `AiCredentialService.incrementSpent(credentialId, ...)` sau khi success.
 */
export interface ResolvedAiConfig {
  provider: AiProvider
  apiKey: string                                    // decrypted plain
  baseUrl: string | null
  model: string | null
  source: 'WORKSPACE' | 'SYSTEM' | 'ENV'
  credentialId: string | null
}

@Injectable()
export class AiCredentialResolver {
  private readonly logger = new Logger(AiCredentialResolver.name)

  constructor(
    private readonly repo: AiCredentialRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async resolve(provider: AiProvider, workspaceId: string): Promise<ResolvedAiConfig> {
    // 1. Workspace BYOK
    const ws = await this.repo.findActiveByScope('WORKSPACE', workspaceId, provider)
    if (ws) {
      this.assertBudget(ws)
      return this.mapEntity(provider, ws, 'WORKSPACE')
    }

    // 2. System default
    const sys = await this.repo.findActiveByScope('SYSTEM', null, provider)
    if (sys) {
      this.assertBudget(sys)
      return this.mapEntity(provider, sys, 'SYSTEM')
    }

    // 3. .env fallback
    const envConfig = this.getEnvConfig(provider)
    if (envConfig) return envConfig

    throw new AppException(ResponseCode.AiCredentialNotConfigured, {
      provider,
      hint: 'Configure AI credential trong Workspace Settings → AI Credentials',
    })
  }

  /**
   * Status row — KHÔNG decrypt. UI dùng để render table.
   */
  async describe(provider: AiProvider, workspaceId: string): Promise<{
    provider: AiProvider
    source: 'WORKSPACE' | 'SYSTEM' | 'ENV' | 'NONE'
    credentialId: string | null
    model: string | null
    isActive: boolean
    monthlyBudgetUsd: number | null
    monthSpentUsd: number
    notes: string | null
    updatedAt: Date | null
  }> {
    const ws = await this.repo.findByScope('WORKSPACE', workspaceId, provider)
    if (ws && ws.isActive) {
      return {
        provider,
        source: 'WORKSPACE',
        credentialId: ws.id,
        model: ws.model,
        isActive: ws.isActive,
        monthlyBudgetUsd: ws.monthlyBudgetUsd ? Number(ws.monthlyBudgetUsd) : null,
        monthSpentUsd: Number(ws.monthSpentUsd),
        notes: ws.notes,
        updatedAt: ws.updatedAt,
      }
    }

    const sys = await this.repo.findByScope('SYSTEM', null, provider)
    if (sys && sys.isActive) {
      return {
        provider,
        source: 'SYSTEM',
        credentialId: sys.id,
        model: sys.model,
        isActive: sys.isActive,
        monthlyBudgetUsd: sys.monthlyBudgetUsd ? Number(sys.monthlyBudgetUsd) : null,
        monthSpentUsd: Number(sys.monthSpentUsd),
        notes: sys.notes,
        updatedAt: sys.updatedAt,
      }
    }

    if (this.hasEnvKey(provider)) {
      return {
        provider,
        source: 'ENV',
        credentialId: null,
        model: this.getEnvModel(provider),
        isActive: true,
        monthlyBudgetUsd: null,
        monthSpentUsd: 0,
        notes: null,
        updatedAt: null,
      }
    }

    return {
      provider,
      source: 'NONE',
      credentialId: null,
      model: null,
      isActive: false,
      monthlyBudgetUsd: null,
      monthSpentUsd: 0,
      notes: null,
      updatedAt: null,
    }
  }

  /**
   * Atomic increment monthSpentUsd. Emit warning log khi vượt budget.
   * Caller decide có disable credential không (tránh tight coupling).
   */
  async incrementSpent(credentialId: string, amountUsd: number): Promise<void> {
    if (amountUsd <= 0) return
    const updated = await this.repo.incrementSpent(credentialId, amountUsd)
    if (updated.monthlyBudgetUsd && Number(updated.monthSpentUsd) > Number(updated.monthlyBudgetUsd)) {
      this.logger.warn(
        `AI credential ${credentialId} (${updated.provider}) exceeded budget: ${updated.monthSpentUsd} > ${updated.monthlyBudgetUsd} USD`,
      )
    }
  }

  private assertBudget(entity: AiCredential): void {
    if (!entity.monthlyBudgetUsd) return
    const spent = Number(entity.monthSpentUsd)
    const budget = Number(entity.monthlyBudgetUsd)
    if (spent >= budget) {
      throw new AppException(ResponseCode.AiBudgetExceeded, {
        credentialId: entity.id,
        provider: entity.provider,
        spent,
        budget,
      })
    }
  }

  private mapEntity(
    provider: AiProvider,
    entity: AiCredential,
    source: 'WORKSPACE' | 'SYSTEM',
  ): ResolvedAiConfig {
    let plainKey: string
    try {
      plainKey = decrypt(entity.apiKey, this.config.encryption.key)
    }
    catch (err) {
      this.logger.error(`Failed decrypt AiCredential ${entity.id}`, err as Error)
      throw new AppException(ResponseCode.AiCredentialInvalid, { credentialId: entity.id })
    }
    return {
      provider,
      apiKey: plainKey,
      baseUrl: entity.baseUrl,
      model: entity.model,
      source,
      credentialId: entity.id,
    }
  }

  private getEnvConfig(provider: AiProvider): ResolvedAiConfig | null {
    // apps/api KHÔNG có AI key env trực tiếp (key ở apps/ai). Khi source=ENV,
    // resolver trả `apiKey=''` + credentialId=null — apps/ai sẽ tự dùng env
    // của nó. Đây là backward-compat mode: workspace chưa BYOK → AI client
    // call như cũ, apps/ai dùng OPENAI_API_KEY mặc định.
    if (provider === 'OPENAI' || provider === 'ANTHROPIC' || provider === 'GOOGLE_GEMINI') {
      return {
        provider,
        apiKey: '',
        baseUrl: null,
        model: null,
        source: 'ENV',
        credentialId: null,
      }
    }
    return null
  }

  private hasEnvKey(_provider: AiProvider): boolean {
    // apps/api không kiểm tra trực tiếp được env của apps/ai. Coi như có ENV
    // fallback nếu apps/ai response cho health check thấy provider sẵn sàng.
    // Để đơn giản: luôn report ENV cho 3 provider — UI hiển thị "Default (env)".
    return true
  }

  private getEnvModel(provider: AiProvider): string | null {
    // Best-effort hint — model thật do apps/ai quyết. UI chỉ dùng làm placeholder.
    switch (provider) {
      case 'OPENAI': return 'gpt-4o-mini'
      case 'ANTHROPIC': return 'claude-sonnet-4-6'
      case 'GOOGLE_GEMINI': return 'gemini-1.5-flash'
      default: return null
    }
  }
}
