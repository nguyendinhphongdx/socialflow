import { Inject, Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { cuid } from './cuid-helper'
import type { Prisma, PublishRecord, PublishStatus } from '@prisma/client'
import { AppException, ResponseCode, type PaginationDto } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { SocialAccountService } from '../social-account/social-account.service'
import { SocialAccountRepository } from '../social-account/social-account.repository'
import { MediaService } from '../media/media.service'
import { PublishRepository } from './publish.repository'
import type { CreatePublishDto } from './publish.dto'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'

interface PublishImmediateJob {
  recordId: string
}

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name)

  constructor(
    private readonly repo: PublishRepository,
    private readonly accountRepo: SocialAccountRepository,
    private readonly accountService: SocialAccountService,
    private readonly mediaService: MediaService,
    private readonly ctx: RequestContextService,
    @InjectQueue(QUEUE_NAMES.PUBLISH_IMMEDIATE)
    private readonly queue: Queue<PublishImmediateJob>,
  ) {}

  async createBundle(dto: CreatePublishDto): Promise<PublishRecord[]> {
    const userId = this.ctx.requireUserId()

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.repo.getByIdempotencyKey(userId, dto.idempotencyKey)
      if (existing) {
        return this.repo.listByUserWithPagination(userId, { page: 1, pageSize: 50 }, { flowId: existing.flowId ?? undefined })
          .then(p => p.list)
      }
    }

    // Verify accounts owned + ACTIVE
    const accounts = await Promise.all(
      dto.accountIds.map(id => this.accountRepo.getByIdAndUserId(id, userId)),
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

  async listByCurrentUser(pagination: PaginationDto, filter?: { status?: any, accountId?: string, flowId?: string }) {
    const userId = this.ctx.requireUserId()
    return this.repo.listByUserWithPagination(userId, pagination, filter)
  }

  async getByCurrentUserAndId(id: string) {
    const userId = this.ctx.requireUserId()
    const record = await this.repo.getByIdAndUserId(id, userId)
    if (!record) throw new AppException(ResponseCode.PublishTaskNotFound, { recordId: id })
    return record
  }

  async cancel(id: string): Promise<PublishRecord> {
    const record = await this.getByCurrentUserAndId(id)
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
}
