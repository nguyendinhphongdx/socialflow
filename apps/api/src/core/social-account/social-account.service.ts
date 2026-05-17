import { Inject, Injectable, Logger } from '@nestjs/common'
import type { AccountPlatform, AccountStatus, SocialAccount } from '@prisma/client'
import { AppException, ResponseCode, type Paginated, type PaginationDto } from '@sociflow/common'
import { decrypt, encrypt } from '@sociflow/common/crypto'
import { RequestContextService } from '@sociflow/auth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { SocialAccountRepository } from './social-account.repository'

interface SaveOAuthTokensInput {
  userId: string
  workspaceId: string
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

  /**
   * @deprecated F-716 — dùng `listByCurrentWorkspace`.
   */
  async listByCurrentUser(
    pagination: PaginationDto,
    filter?: { platform?: AccountPlatform, status?: AccountStatus },
  ): Promise<Paginated<SocialAccount>> {
    return this.listByCurrentWorkspace(pagination, filter)
  }

  async listByCurrentWorkspace(
    pagination: PaginationDto,
    filter?: { platform?: AccountPlatform, status?: AccountStatus },
  ): Promise<Paginated<SocialAccount>> {
    const workspaceId = this.ctx.requireWorkspaceId()
    return this.repo.listByWorkspaceWithPagination(workspaceId, pagination, filter)
  }

  /**
   * @deprecated F-716 — dùng `getByCurrentWorkspaceAndId`.
   */
  async getByCurrentUserAndId(id: string): Promise<SocialAccount> {
    return this.getByCurrentWorkspaceAndId(id)
  }

  async getByCurrentWorkspaceAndId(id: string): Promise<SocialAccount> {
    const workspaceId = this.ctx.requireWorkspaceId()
    const account = await this.repo.getByIdAndWorkspaceId(id, workspaceId)
    if (!account) throw new AppException(ResponseCode.AccountNotFound, { accountId: id })
    return account
  }

  /**
   * Lookup theo id (không kiểm tra owner) — dùng cho worker context (publish
   * consumer, insight rollup, ...) khi không có user CLS context.
   */
  async getById(id: string): Promise<SocialAccount | null> {
    return this.repo.getById(id)
  }

  /**
   * Lookup nullable theo id + ownership workspace hiện tại — dùng cho bulk validate
   * khi caller cần aggregate kết quả (vd publish bundle multi-account).
   */
  async getByIdForCurrentUser(id: string): Promise<SocialAccount | null> {
    const workspaceId = this.ctx.requireWorkspaceId()
    return this.repo.getByIdAndWorkspaceId(id, workspaceId)
  }

  async saveOAuthTokens(input: SaveOAuthTokensInput): Promise<SocialAccount> {
    const tokenExpiresAt = input.expiresIn
      ? new Date(Date.now() + input.expiresIn * 1000)
      : null

    const account = await this.repo.upsertByPlatformUid({
      userId: input.userId,
      workspaceId: input.workspaceId,
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

  /**
   * Lookup theo platform + uid — webhook handler dùng để map platform event
   * (vd Meta page_id) sang internal account id.
   */
  async findByPlatformUid(platform: AccountPlatform, platformUid: string): Promise<SocialAccount | null> {
    return this.repo.findByPlatformUid(platform, platformUid)
  }

  /**
   * List account ACTIVE publishMode API — insight.scheduler dùng để batch
   * snapshot follower/engagement định kỳ.
   */
  async listActiveApiAccounts(limit?: number): Promise<SocialAccount[]> {
    return this.repo.listActiveApiAccounts(limit)
  }

  /**
   * Lookup theo id + userId (không qua CLS) — insight worker context có userId
   * tường minh từ publish record, không có request CLS.
   */
  async getByIdAndUserId(id: string, userId: string): Promise<SocialAccount | null> {
    return this.repo.getByIdAndUserId(id, userId)
  }

  async softDelete(id: string): Promise<void> {
    const account = await this.getByCurrentWorkspaceAndId(id)
    await this.repo.softDeleteById(account.id)
  }
}
