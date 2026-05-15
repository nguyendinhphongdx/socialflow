import { Inject, Injectable } from '@nestjs/common'
import { Queue, type JobsOptions } from 'bullmq'
import { v7 as uuidv7 } from 'uuid'
import { RequestContextService } from '@sociflow/auth'
import type { JobContext, JobEnvelope } from './job-context.type'

/**
 * Wrapper quanh BullMQ `Queue` — bắt buộc dùng thay vì raw `Queue.add`.
 *
 * Tự động:
 * - Attach `__ctx` (userId, traceId) từ CLS vào job data
 * - Generate traceId mới nếu CLS rỗng (job từ scheduler, cron)
 *
 * Inject 1 instance per queue qua factory provider:
 * ```ts
 * { provide: 'PUBLISH_QUEUE', useFactory: ... → new QueueProducer(new Queue('publish', { connection }), ctx) }
 * ```
 */
@Injectable()
export class QueueProducer<T = unknown> {
  constructor(
    private readonly queue: Queue,
    @Inject(RequestContextService) private readonly context: RequestContextService,
  ) {}

  async add(name: string, data: T, opts?: JobsOptions): Promise<void> {
    const envelope: JobEnvelope<T> = {
      __ctx: this.buildContext(),
      data,
    }
    await this.queue.add(name, envelope, opts)
  }

  async addBulk(jobs: Array<{ name: string, data: T, opts?: JobsOptions }>): Promise<void> {
    const ctx = this.buildContext()
    await this.queue.addBulk(
      jobs.map(j => ({
        name: j.name,
        data: { __ctx: ctx, data: j.data } satisfies JobEnvelope<T>,
        opts: j.opts,
      })),
    )
  }

  getQueue(): Queue {
    return this.queue
  }

  private buildContext(): JobContext {
    return {
      userId: this.context.userId,
      sessionId: this.context.sessionId,
      traceId: this.context.traceId ?? uuidv7(),
    }
  }
}
