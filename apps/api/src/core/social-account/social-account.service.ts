import { Inject, Injectable, Logger } from '@nestjs/common'
import type { SocialAccount } from '@prisma/client'
import { AppException, ResponseCode, type PaginationDto } from '@sociflow/common'
import { decrypt, encrypt } from '@sociflow/common/crypto'
import { RequestContextService } from '@sociflow/auth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { SocialAccountRepository } from './social-account.repository'

interface SaveOAuthTokensInput {
  userId: string
  platform: 'YOUTUBE' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK'
  platformUid: string
  displayName: string
  avatarUrl?: string
  accessToken: string
  refreshToken?: string
  expiresIn?: number             // seconds
  scopes: string[]
  metadata?: Record<string, unknown>
  groupId?: string
}

@Injectable()
export class SocialAccountService {
  private readonly logger = new Logger(SocialAccountService.name)

  constructor(
    private readonly repo: SocialAccountRepository,
    private readonly ctx: RequestContextService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async listByCurrentUser(pagination: PaginationDto, filter?: { platform?: any, status?: any }) {
    const userId = this.ctx.requireUserId()
    return this.repo.listByUserWithPagination(userId, pagination, filter)
  }

  async getByCurrentUserAndId(id: string): Promise<SocialAccount> {
    const userId = this.ctx.requireUserId()
    const account = await this.repo.getByIdAndUserId(id, userId)
    if (!account) throw new AppException(ResponseCode.AccountNotFound, { accountId: id })
    return account
  }

  async saveOAuthTokens(input: SaveOAuthTokensInput): Promise<SocialAccount> {
    const tokenExpiresAt = input.expiresIn
      ? new Date(Date.now() + input.expiresIn * 1000)
      : null

    const account = await this.repo.upsertByPlatformUid({
      userId: input.userId,
      platform: input.platform,
      platformUid: input.platformUid,
      data: {
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        publishMode: 'API',
        accessToken: encrypt(input.accessToken, this.config.encryption.key),
        refreshToken: input.refreshToken ? encrypt(input.refreshToken, this.config.encryption.key) : null,
        tokenExpiresAt,
        scopes: input.scopes,
        metadata: input.metadata as object | undefined,
        status: 'ACTIVE',
        lastSyncAt: new Date(),
        ...(input.groupId && { group: { connect: { id: input.groupId } } }),
      },
    })

    this.logger.log(`Connected ${input.platform} account ${account.id} for user ${input.userId}`)
    return account
  }

  /**
   * Decrypt accessToken cho service khác (publish provider, refresh job).
   * KHÔNG expose ra Controller — chỉ internal.
   */
  decryptAccessToken(account: SocialAccount): string {
    if (!account.accessToken) {
      throw new AppException(ResponseCode.AccountTokenExpired, { accountId: account.id })
    }
    return decrypt(account.accessToken, this.config.encryption.key)
  }

  decryptRefreshToken(account: SocialAccount): string | null {
    if (!account.refreshToken) return null
    return decrypt(account.refreshToken, this.config.encryption.key)
  }

  async updateTokens(accountId: string, accessToken: string, refreshToken?: string, expiresIn?: number) {
    return this.repo.updateById(accountId, {
      accessToken: encrypt(accessToken, this.config.encryption.key),
      ...(refreshToken && {
        refreshToken: encrypt(refreshToken, this.config.encryption.key),
      }),
      ...(expiresIn && {
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      }),
      lastSyncAt: new Date(),
    })
  }

  async markTokenExpired(accountId: string) {
    return this.repo.updateById(accountId, { status: 'TOKEN_EXPIRED' })
  }

  async softDelete(id: string): Promise<void> {
    const account = await this.getByCurrentUserAndId(id)
    await this.repo.softDeleteById(account.id)
  }
}
