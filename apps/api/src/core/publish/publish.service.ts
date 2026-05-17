import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { cuid } from './cuid-helper'
import type { PublishRecord, PublishStatus } from '@prisma/client'
import { AppException, ResponseCode, type Paginated, type PaginationDto } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { SocialAccountService } from '../social-account/social-account.service'
import { MediaService } from '../media/media.service'
import { PublishRepository, type PublishRecordWithAccount } from './publish.repository'
import type { CreatePublishDto } from './publish.dto'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'
import { RedlockService } from '../../libs/redlock/redlock.service'

interface PublishImmediateJob {
  recordId: string
}

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name)

  constructor(
    private readonly repo: PublishRepository,
    private readonly accountService: SocialAccountService,
    private readonly mediaService: MediaService,
    private readonly ctx: RequestContextService,
    @InjectQueue(QUEUE_NAMES.PUBLISH_IMMEDIATE)
    private readonly queue: Queue<PublishImmediateJob>,
    private readonly redlock: RedlockService,
  ) {}

  async createBundle(dto: CreatePublishDto): Promise<PublishRecord[]> {
    const userId = this.ctx.requireUserId()
    const workspaceId = this.ctx.requireWorkspaceId()

    // Distributed lock per (workspaceId, idempotencyKey) chống double-submit từ
    // 2 tab/2 client cùng gửi 1 request — DB unique constraint là backstop,
    // nhưng lock cho UX tốt hơn (caller chờ thay vì 409).
    if (dto.idempotencyKey) {
      return this.redlock.withLock(
        `publish:bundle:${workspaceId}:${dto.idempotencyKey}`,
        () => this.createBundleInner(userId, workspaceId, dto),
        { ttlMs: 30_000 },
      )
    }
    return this.createBundleInner(userId, workspaceId, dto)
  }

  private async createBundleInner(userId: string, workspaceId: string, dto: CreatePublishDto): Promise<PublishRecord[]> {
    // Idempotency check (workspace-scoped)
    if (dto.idempotencyKey) {
      const existing = await this.repo.getByWorkspaceIdAndIdempotencyKey(workspaceId, dto.idempotencyKey)
      if (existing) {
        return this.repo.listByWorkspaceWithPagination(workspaceId, { page: 1, pageSize: 50 }, { flowId: existing.flowId ?? undefined })
          .then(p => p.list)
      }
    }

    // Verify accounts owned + ACTIVE (workspace-scoped qua getByIdForCurrentUser)
    const accounts = await Promise.all(
      dto.accountIds.map(id => this.accountService.getByIdForCurrentUser(id)),
    )
    if (accounts.some(a => !a || a.status !== 'ACTIVE')) {
      throw new AppException(ResponseCode.AccountNotFound, {
        invalidAccounts: dto.accountIds.filter((_, i) => !accounts[i] || accounts[i]!.status !== 'ACTIVE'),
      })
    }

    // Verify media uploaded
    await this.mediaService.listForPublish(dto.mediaIds)

    const flowId = cuid()
    const publishTime = dto.publishTime ?? new Date()
    const isImmediate = publishTime <= new Date()
    const status: PublishStatus = isImmediate ? 'PENDING' : 'SCHEDULED'

    const created: PublishRecord[] = []
    for (const [i, account] of accounts.entries()) {
      const record = await this.repo.create({
        user: { connect: { id: userId } },
        workspace: { connect: { id: workspaceId } },
        account: { connect: { id: account!.id } },
        flowId,
        publishMode: account!.publishMode,
        title: dto.title,
        body: dto.body,
        mediaIds: dto.mediaIds,
        platformOptions: dto.platformOptions as object | undefined,
        publishTime,
        status,
        ...(i === 0 && dto.idempotencyKey && { idempotencyKey: dto.idempotencyKey }),
      })
      created.push(record)
    }

    // Enqueue immediate
    if (isImmediate) {
      await this.queue.addBulk(
        created.map(r => ({
          name: 'publish',
          data: { recordId: r.id } satisfies PublishImmediateJob,
          opts: { jobId: `publish-${r.id}` },
        })),
      )
    }

    this.logger.log(`Created publish flow ${flowId} với ${created.length} records (immediate=${isImmediate})`)
    return created
  }

  /** @deprecated F-716 — dùng `listByCurrentWorkspace`. */
  async listByCurrentUser(
    pagination: PaginationDto,
    filter?: { status?: PublishStatus, accountId?: string, flowId?: string },
  ): Promise<Paginated<PublishRecordWithAccount>> {
    return this.listByCurrentWorkspace(pagination, filter)
  }

  async listByCurrentWorkspace(
    pagination: PaginationDto,
    filter?: { status?: PublishStatus, accountId?: string, flowId?: string },
  ): Promise<Paginated<PublishRecordWithAccount>> {
    const workspaceId = this.ctx.requireWorkspaceId()
    return this.repo.listByWorkspaceWithPagination(workspaceId, pagination, filter)
  }

  /**
   * Lấy bundle các record cùng `flowId` của workspace hiện tại — dùng cho response
   * của `createBundle` (controller).
   */
  async listBundleByFlowId(flowId: string): Promise<Paginated<PublishRecordWithAccount>> {
    const workspaceId = this.ctx.requireWorkspaceId()
    return this.repo.listByWorkspaceWithPagination(workspaceId, { page: 1, pageSize: 50 }, { flowId })
  }

  /** @deprecated F-716 — dùng `getByCurrentWorkspaceAndId`. */
  async getByCurrentUserAndId(id: string) {
    return this.getByCurrentWorkspaceAndId(id)
  }

  async getByCurrentWorkspaceAndId(id: string) {
    const workspaceId = this.ctx.requireWorkspaceId()
    const record = await this.repo.getByIdAndWorkspaceId(id, workspaceId)
    if (!record) throw new AppException(ResponseCode.PublishTaskNotFound, { recordId: id })
    return record
  }

  async cancel(id: string): Promise<PublishRecord> {
    const record = await this.getByCurrentWorkspaceAndId(id)
    if (['PUBLISHED', 'CANCELLED', 'REJECTED'].includes(record.status)) {
      throw new AppException(ResponseCode.PublishTaskInvalid, { reason: 'already_finalized' })
    }
    return this.repo.updateById(record.id, { status: 'CANCELLED' })
  }

  /**
   * Internal API cho consumer cập nhật status.
   */
  async markDispatched(recordId: string): Promise<boolean> {
    return this.repo.markStatusAtomic(recordId, 'PENDING', 'DISPATCHED')
  }

  async markInProgress(recordId: string, stage?: string): Promise<void> {
    await this.repo.updateById(recordId, { status: 'IN_PROGRESS', stage })
  }

  async markPublished(recordId: string, result: { platformPostId: string, workLink: string }): Promise<void> {
    await this.repo.updateById(recordId, {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      platformPostId: result.platformPostId,
      workLink: result.workLink,
      errorMessage: null,
    })
  }

  async markFailed(recordId: string, error: string, willRetry: boolean): Promise<void> {
    const current = await this.repo.getById(recordId)
    if (!current) return
    await this.repo.updateById(recordId, {
      status: willRetry ? 'PENDING' : 'FAILED',
      errorMessage: error,
      retryCount: current.retryCount + 1,
    })
  }

  async markRejected(recordId: string, reason: string): Promise<void> {
    await this.repo.updateById(recordId, {
      status: 'REJECTED',
      errorMessage: reason,
    })
  }

  /**
   * Lookup theo id (không kiểm tra ownership) — worker context (insight rollup,
   * cross-user scheduler) khi không có user CLS.
   */
  async getById(id: string): Promise<PublishRecord | null> {
    return this.repo.getById(id)
  }

  /**
   * Lookup theo id + userId tường minh — dùng cho insight worker khi userId
   * đến từ context khác CLS (vd resolved từ publish record).
   */
  async getByIdAndUserId(id: string, userId: string): Promise<PublishRecordWithAccount | null> {
    return this.repo.getByIdAndUserId(id, userId)
  }

  /**
   * List record `PUBLISHED` cho 1 account trong khoảng thời gian — insight
   * service dùng để aggregate engagement theo ngày.
   */
  async listPublishedByAccountInRange(accountId: string, fromDate: Date, toDate: Date): Promise<PublishRecord[]> {
    return this.repo.listPublishedByAccountInRange(accountId, fromDate, toDate)
  }

  /**
   * List record published gần đây có `platformPostId` — insight.scheduler batch
   * fetch metric từ platform.
   */
  async listRecentPublishedWithPlatformPostId(sinceDate: Date, limit?: number): Promise<PublishRecord[]> {
    return this.repo.listRecentPublishedWithPlatformPostId(sinceDate, limit)
  }
}
