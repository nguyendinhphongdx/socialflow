import { ClsService } from 'nestjs-cls'
import { v7 as uuidv7 } from 'uuid'
import type { Job } from 'bullmq'
import type { JobContext, JobEnvelope } from './job-context.type'

/**
 * Helper để consumer (`@Processor`) restore CLS context từ job envelope.
 *
 * Usage trong `@Processor` class:
 * ```ts
 * @Processor('publish')
 * export class PublishConsumer extends WorkerHost {
 *   constructor(private readonly cls: ClsService, private readonly service: PublishService) { super() }
 *
 *   async process(job: Job<JobEnvelope<PublishJobData>>) {
 *     return runWithJobContext(this.cls, job, async (data) => this.service.process(data))
 *   }
 * }
 * ```
 */
export async function runWithJobContext<T, R>(
  cls: ClsService,
  job: Job<JobEnvelope<T>>,
  fn: (data: T) => Promise<R>,
): Promise<R> {
  const envelope = job.data
  const ctx: JobContext = envelope.__ctx ?? { traceId: uuidv7() }
  return cls.run({}, async () => {
    cls.set('traceId', ctx.traceId)
    if (ctx.userId !== undefined) cls.set('userId', ctx.userId)
    if (ctx.sessionId !== undefined) cls.set('sessionId', ctx.sessionId)
    cls.set('jobId', job.id)
    cls.set('jobName', job.name)
    return fn(envelope.data)
  })
}
