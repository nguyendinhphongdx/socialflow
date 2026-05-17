import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import type { SocialAccount, PublishRecord, MediaAsset } from '@prisma/client'
import { AppException, ResponseCode, RetryableError } from '@sociflow/common'
import type { PublishCommand } from '@sociflow/ws-protocol'
import { SocialAccountService } from '../social-account/social-account.service'
import { MediaService } from '../media/media.service'
import { PublishRepository } from './publish.repository'
import { PublishService } from './publish.service'
import { PublishProviderRegistry } from './publish-provider.registry'
import { AgentDispatcherService } from '../agent/ws/agent-dispatcher.service'
import { AutomationTaskService } from '../agent/ws/automation-task.service'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'

interface PublishImmediateJob {
  recordId: string
}

const PLATFORM_MAP: Record<SocialAccount['platform'], 'YOUTUBE' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK'> = {
  YOUTUBE: 'YOUTUBE',
  FACEBOOK: 'FACEBOOK',
  INSTAGRAM: 'INSTAGRAM',
  TIKTOK: 'TIKTOK',
}

@Processor(QUEUE_NAMES.PUBLISH_IMMEDIATE, { concurrency: 5 })
export class PublishConsumer extends WorkerHost {
  private readonly logger = new Logger(PublishConsumer.name)

  constructor(
    private readonly repo: PublishRepository,
    private readonly service: PublishService,
    private readonly accountService: SocialAccountService,
    private readonly mediaService: MediaService,
    private readonly registry: PublishProviderRegistry,
    private readonly agentDispatcher: AgentDispatcherService,
    private readonly automationTaskService: AutomationTaskService,
  ) {
    super()
  }

  async process(job: Job<PublishImmediateJob>): Promise<void> {
    const { recordId } = job.data
    const record = await this.repo.getById(recordId)
    if (!record) {
      this.logger.warn(`Record ${recordId} not found — skip`)
      return
    }
    if (['PUBLISHED', 'CANCELLED', 'REJECTED'].includes(record.status)) {
      this.logger.warn(`Record ${recordId} already ${record.status} — skip`)
      return
    }

    const account = await this.accountService.getById(record.accountId)
    if (!account) {
      await this.service.markFailed(recordId, 'account_not_found', false)
      return
    }

    // F-716 — worker context: dùng workspaceId trên PublishRecord (no CLS).
    const mediaAssets = await this.mediaService.listForPublishByWorkspaceId(record.workspaceId, record.mediaIds)

    // Route theo publishMode: API → provider; AUTOMATION → agent dispatch
    if (account.publishMode === 'AUTOMATION') {
      return this.dispatchToAgent(job, record, account, mediaAssets)
    }
    return this.publishViaProvider(job, record, account, mediaAssets)
  }

  private async publishViaProvider(
    job: Job<PublishImmediateJob>,
    record: PublishRecord,
    account: SocialAccount,
    mediaAssets: MediaAsset[],
  ): Promise<void> {
    const provider = this.registry.get(account.platform)
    const decryptedToken = this.accountService.decryptAccessToken(account)

    await this.service.markInProgress(record.id, `provider:${account.platform}`)

    try {
      const result = await provider.publish({
        record,
        account,
        decryptedAccessToken: decryptedToken,
        mediaAssets,
      })
      await this.service.markPublished(record.id, result)
      this.logger.log(`Published record ${record.id} → ${result.workLink}`)
    }
    catch (err) {
      await this.handleProviderError(err, job, record.id, account.id)
    }
  }

  /**
   * AUTOMATION mode — tạo AutomationTask + dispatch command qua WS gateway.
   * Worker job kết thúc ngay sau dispatch. Status updates (a2s:*) sẽ
   * cập nhật PublishRecord qua AgentGateway.handleComplete/handleFailed.
   */
  private async dispatchToAgent(
    job: Job<PublishImmediateJob>,
    record: PublishRecord,
    account: SocialAccount,
    mediaAssets: MediaAsset[],
  ): Promise<void> {
    if (!account.agentId) {
      await this.service.markFailed(record.id, 'no_agent_linked', false)
      return
    }

    const payload = {
      platform: PLATFORM_MAP[account.platform],
      accountUid: account.platformUid,
      content: this.buildContent(record, mediaAssets),
      timeout: 15 * 60 * 1000,
    }

    const task = await this.automationTaskService.createForPublish({
      publishRecord: record,
      agentId: account.agentId,
      command: 'PUBLISH_POST',
      payload,
      timeoutMs: payload.timeout,
    })

    const command: PublishCommand = {
      type: 's2a:publish',
      taskId: task.id,
      platform: payload.platform,
      accountUid: payload.accountUid,
      content: payload.content,
      timeout: payload.timeout,
    }

    try {
      await this.agentDispatcher.dispatchPublish(task.id, account.agentId, command)
      await this.service.markInProgress(record.id, `agent:${account.agentId}`)
      this.logger.log(`Dispatched record ${record.id} to agent ${account.agentId} (task ${task.id})`)
    }
    catch (err) {
      if (err instanceof AppException && err.code === ResponseCode.AgentOffline) {
        await this.service.markFailed(record.id, 'agent_offline', true)
        throw new RetryableError('agent offline — retry')
      }
      throw err
    }
  }

  private buildContent(record: PublishRecord, mediaAssets: MediaAsset[]) {
    return {
      title: record.title,
      body: record.body,
      mediaUrls: mediaAssets.map(m => ({
        url: m.publicUrl,
        type: m.type,
        mimeType: m.mimeType,
        sizeBytes: m.sizeBytes,
      })),
      platformOptions: (record.platformOptions ?? undefined) as Record<string, unknown> | undefined,
    }
  }

  private async handleProviderError(err: unknown, job: Job, recordId: string, accountId: string): Promise<void> {
    if (err instanceof RetryableError) {
      const willRetry = (job.attemptsMade ?? 0) < (job.opts.attempts ?? 3) - 1
      await this.service.markFailed(recordId, err.message, willRetry)
      throw err
    }
    if (err instanceof AppException) {
      if (err.code === ResponseCode.PublishRejectedByPlatform) {
        await this.service.markRejected(recordId, JSON.stringify(err.data))
        return
      }
      if (err.code === ResponseCode.AccountTokenExpired) {
        await this.accountService.markTokenExpired(accountId)
        await this.service.markFailed(recordId, 'account_token_expired', false)
        return
      }
      await this.service.markFailed(recordId, JSON.stringify({ code: err.code, data: err.data }), false)
      return
    }
    this.logger.error(`Unexpected publish error for ${recordId}`, err as Error)
    await this.service.markFailed(recordId, String(err), false)
    throw err
  }
}
