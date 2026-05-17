import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { ApiKey, User } from '@prisma/client'
import { AppException, ResponseCode, type PaginationDto } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { UserService } from '../user/user.service'
import {
  API_KEY_SCOPES,
  KEY_PREFIX_RANDOM_LEN,
  KEY_SECRET_RANDOM_BYTES,
  type ApiKeyScope,
} from './api-key.constants'
import { API_KEY_EVENTS, type ApiKeyCreatedEvent, type ApiKeyRevokedEvent, type ApiKeyUsedEvent } from './api-key.events'
import { ApiKeyRepository } from './api-key.repository'

export interface ApiKeyValidationResult {
  apiKey: ApiKey
  user: User
  scopes: string[]
}

/**
 * Format raw key: `sf_<env>_<8-char-prefix><base64url-secret>`
 *  - `sf_`           — namespace ổn định
 *  - `live` | `test` — env discriminator
 *  - `<prefix>`      — 8 char base64url random, hiển thị cho user (UI list)
 *  - `<secret>`      — 32-byte random (base64url ~ 43 chars). Phần sau prefix.
 *
 * Hash công thức: `sha256(rawKey + pepper)` (pepper từ ENCRYPTION_KEY).
 *  - Pepper khiến rainbow-table lên DB vô dụng nếu key leak nhưng pepper không leak.
 *  - Không dùng bcrypt ở đây vì validate phải nhanh (mọi request authed bằng API key).
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name)
  private readonly env: 'live' | 'test'
  private readonly pepper: string

  constructor(
    private readonly repo: ApiKeyRepository,
    private readonly ctx: RequestContextService,
    private readonly events: EventEmitter2,
    private readonly userService: UserService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.env = config.app.env === 'production' ? 'live' : 'test'
    // Reuse ENCRYPTION_KEY làm pepper (đã 32 byte base64) — đảm bảo rotation policy giống.
    // Khi rotate, cần re-issue toàn bộ key (đã document trong runbook).
    this.pepper = config.encryption.key
  }

  // ----------------------------------------------------------------------
  // User-facing CRUD
  // ----------------------------------------------------------------------

  async create(input: { name: string, scopes: string[], expiresAt?: Date }): Promise<{ entity: ApiKey, rawKey: string }> {
    const userId = this.ctx.requireUserId()
    this.assertScopes(input.scopes)

    const { rawKey, prefix } = this.generateKey()
    const keyHash = this.hashKey(rawKey)

    const entity = await this.repo.create({
      user: { connect: { id: userId } },
      keyHash,
      prefix,
      name: input.name,
      scopes: input.scopes,
      expiresAt: input.expiresAt,
    })

    this.events.emit(API_KEY_EVENTS.CREATED, {
      apiKeyId: entity.id,
      userId,
      scopes: entity.scopes,
      prefix: entity.prefix,
      expiresAt: entity.expiresAt,
    } satisfies ApiKeyCreatedEvent)

    this.logger.log(`API key created: id=${entity.id} prefix=${prefix} scopes=${input.scopes.join(',')}`)
    return { entity, rawKey }
  }

  async listByCurrentUser(pagination: PaginationDto, filter?: { includeRevoked?: boolean }) {
    const userId = this.ctx.requireUserId()
    return this.repo.listByUserIdWithPagination(userId, pagination, filter)
  }

  async getByCurrentUserAndId(id: string): Promise<ApiKey> {
    const userId = this.ctx.requireUserId()
    const entity = await this.repo.getByIdAndUserId(id, userId)
    if (!entity) throw new AppException(ResponseCode.ApiKeyNotFound, { apiKeyId: id })
    return entity
  }

  async revoke(id: string): Promise<void> {
    const entity = await this.getByCurrentUserAndId(id)
    if (entity.revokedAt) return
    const updated = await this.repo.revokeById(entity.id)
    this.events.emit(API_KEY_EVENTS.REVOKED, {
      apiKeyId: updated.id,
      userId: updated.userId,
    } satisfies ApiKeyRevokedEvent)
    this.logger.log(`API key revoked: id=${updated.id}`)
  }

  // ----------------------------------------------------------------------
  // Validate (called bởi ApiKeyAuthGuard)
  // ----------------------------------------------------------------------

  /**
   * Validate raw key. Return null khi key không tồn tại / sai format — guard sẽ throw `ApiKeyInvalid`.
   * Throw `AppException` cho trường hợp expired / revoked (đã định danh được key).
   *
   * `lastUsedAt` update fire-and-forget — không block response.
   */
  async validate(rawKey: string, meta?: { endpoint?: string, ip?: string }): Promise<ApiKeyValidationResult | null> {
    const parsed = this.parseRawKey(rawKey)
    if (!parsed) return null

    const candidate = await this.repo.getActiveByPrefix(parsed.prefix)
    if (!candidate) return null

    const computedHash = this.hashKey(rawKey)
    if (!this.secureEqual(computedHash, candidate.keyHash)) return null

    if (candidate.revokedAt) {
      throw new AppException(ResponseCode.ApiKeyRevoked, { apiKeyId: candidate.id })
    }
    if (candidate.expiresAt && candidate.expiresAt.getTime() < Date.now()) {
      throw new AppException(ResponseCode.ApiKeyExpired, { apiKeyId: candidate.id })
    }

    const user = await this.userService.getById(candidate.userId)

    // Fire-and-forget: update lastUsedAt + emit event.
    this.repo
      .updateLastUsedAt(candidate.id)
      .catch(err => this.logger.warn(`Failed to update lastUsedAt for ${candidate.id}: ${String(err)}`))

    this.events.emit(API_KEY_EVENTS.USED, {
      apiKeyId: candidate.id,
      userId: candidate.userId,
      scopes: candidate.scopes,
      endpoint: meta?.endpoint,
      ip: meta?.ip,
    } satisfies ApiKeyUsedEvent)

    return { apiKey: candidate, user, scopes: candidate.scopes }
  }

  // ----------------------------------------------------------------------
  // Crypto helpers
  // ----------------------------------------------------------------------

  /** Generate raw key + extract prefix component. */
  private generateKey(): { rawKey: string, prefix: string } {
    const prefixRandom = randomBytes(Math.ceil(KEY_PREFIX_RANDOM_LEN * 0.75))
      .toString('base64url')
      .slice(0, KEY_PREFIX_RANDOM_LEN)
    const secretRandom = randomBytes(KEY_SECRET_RANDOM_BYTES).toString('base64url')
    const prefix = `sf_${this.env}_${prefixRandom}`
    const rawKey = `${prefix}${secretRandom}`
    return { rawKey, prefix }
  }

  private parseRawKey(raw: string): { prefix: string } | null {
    // `sf_<env>_<8 prefix random><secret>` — tổng độ dài tối thiểu khoảng 50+ chars.
    if (typeof raw !== 'string' || raw.length < 32) return null
    const m = /^(sf_(?:live|test)_[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+$/.exec(raw)
    if (!m) return null
    return { prefix: m[1] as string }
  }

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).update(this.pepper).digest('hex')
  }

  private secureEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8')
    const bufB = Buffer.from(b, 'utf8')
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
  }

  private assertScopes(scopes: string[]): void {
    const invalid = scopes.filter(s => !API_KEY_SCOPES.includes(s as ApiKeyScope))
    if (invalid.length > 0) {
      throw new AppException(ResponseCode.ValidationFailed, { invalidScopes: invalid })
    }
  }
}
