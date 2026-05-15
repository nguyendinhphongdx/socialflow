import { Injectable, Logger } from '@nestjs/common'
import type { AutomationTask, PublishRecord } from '@prisma/client'
import { AppException, ResponseCode } from '@sociflow/common'
import { AutomationTaskRepository } from './automation-task.repository'

interface CreateForPublishParams {
  publishRecord: PublishRecord
  agentId: string
  command: string                                        // ví dụ 'PUBLISH_POST'
  payload: Record<string, unknown>
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000                // 15 phút

@Injectable()
export class AutomationTaskService {
  private readonly logger = new Logger(AutomationTaskService.name)

  constructor(private readonly repo: AutomationTaskRepository) {}

  async createForPublish(params: CreateForPublishParams): Promise<AutomationTask> {
    const timeout = params.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const task = await this.repo.create({
      agent: { connect: { id: params.agentId } },
      publishRecord: { connect: { id: params.publishRecord.id } },
      command: params.command,
      payload: params.payload as object,
      status: 'PENDING',
      timeoutAt: new Date(Date.now() + timeout),
    })
    this.logger.log(`Created task ${task.id} for publish ${params.publishRecord.id} → agent ${params.agentId}`)
    return task
  }

  async markDispatched(taskId: string): Promise<boolean> {
    return this.repo.markStatusAtomic(taskId, 'PENDING', 'DISPATCHED', {
      dispatchedAt: new Date(),
    })
  }

  async markAcknowledged(taskId: string): Promise<boolean> {
    return this.repo.markStatusAtomic(taskId, 'DISPATCHED', 'ACKNOWLEDGED', {
      acknowledgedAt: new Date(),
    })
  }

  async updateStatus(taskId: string, stage: string, progress: number): Promise<AutomationTask | null> {
    const task = await this.repo.getById(taskId)
    if (!task) return null
    // chấp nhận status hiện tại là ACKNOWLEDGED | IN_PROGRESS | DISPATCHED → chuyển sang IN_PROGRESS
    if (!['DISPATCHED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(task.status)) return task
    return this.repo.updateById(taskId, {
      status: 'IN_PROGRESS',
      stage,
      progress,
    })
  }

  async markSuccess(taskId: string, result: Record<string, unknown>): Promise<AutomationTask | null> {
    const ok = await this.repo.markStatusAtomic(taskId, 'IN_PROGRESS', 'SUCCESS', {
      result: result as object,
      completedAt: new Date(),
    })
    if (!ok) {
      // chấp nhận transition từ ACKNOWLEDGED → SUCCESS (case skip in_progress)
      const ack = await this.repo.markStatusAtomic(taskId, 'ACKNOWLEDGED', 'SUCCESS', {
        result: result as object,
        completedAt: new Date(),
      })
      if (!ack) return null
    }
    return this.repo.getById(taskId)
  }

  async markFailed(taskId: string, errorMessage: string, screenshotUrl?: string | null): Promise<AutomationTask | null> {
    const task = await this.repo.getById(taskId)
    if (!task) return null
    if (['SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(task.status)) return task
    return this.repo.updateById(taskId, {
      status: 'FAILED',
      errorMessage,
      errorScreenshotUrl: screenshotUrl ?? null,
      completedAt: new Date(),
    })
  }

  async markTimeout(taskId: string): Promise<boolean> {
    const task = await this.repo.getById(taskId)
    if (!task) return false
    if (['SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(task.status)) return false
    await this.repo.updateById(taskId, {
      status: 'TIMEOUT',
      errorMessage: 'task_timeout',
      completedAt: new Date(),
    })
    return true
  }

  async findTimedOut(now: Date, limit = 100): Promise<AutomationTask[]> {
    return this.repo.listTimedOut(now, limit)
  }

  async getByPublishRecordId(publishRecordId: string): Promise<AutomationTask | null> {
    return this.repo.getByPublishRecordId(publishRecordId)
  }

  async getById(taskId: string): Promise<AutomationTask> {
    const task = await this.repo.getById(taskId)
    if (!task) throw new AppException(ResponseCode.PublishTaskNotFound, { taskId })
    return task
  }
}
