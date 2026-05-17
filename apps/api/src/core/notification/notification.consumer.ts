import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { AppException, ResponseCode } from '@sociflow/common'
import { EmailService } from './email.service'
import { NotificationRepository } from './notification.repository'
import {
  NOTIFICATION_QUEUE,
  type NotificationSendJob,
} from './notification.constants'

/**
 * Consumer xử lý NOTIFICATION_SEND_JOB:
 *  1. Verify NotificationLog tồn tại + status QUEUED (defense — avoid re-send).
 *  2. Gọi EmailService.sendByType → render template + Resend API.
 *  3. Update log: SENT (kèm provider messageId trong metadata) HOẶC FAILED (errorMessage).
 *  4. Throw nếu Resend lỗi → BullMQ retry theo attempts/backoff.
 *
 * Quy tắc retry:
 *  - 5 attempts với exponential backoff 30s.
 *  - Sau attempt cuối fail → mark FAILED + Sentry capture (qua AppExceptionFilter).
 */
@Processor(NOTIFICATION_QUEUE, { concurrency: 5 })
export class NotificationConsumer extends WorkerHost {
  private readonly logger = new Logger(NotificationConsumer.name)

  constructor(
    private readonly notificationRepo: NotificationRepository,
    private readonly emailService: EmailService,
  ) {
    super()
  }

  async process(job: Job<NotificationSendJob>): Promise<void> {
    const { logId, type, recipient, templateData } = job.data

    const log = await this.notificationRepo.getById(logId)
    if (!log) {
      this.logger.warn(`NotificationLog ${logId} không tồn tại — skip`)
      return
    }
    if (log.status === 'SENT') {
      this.logger.warn(`NotificationLog ${logId} đã SENT — skip duplicate job`)
      return
    }

    try {
      const result = await this.emailService.sendByType(type, recipient, templateData)
      await this.notificationRepo.markSent(logId, {
        providerMessageId: result.messageId,
        attempts: job.attemptsMade + 1,
      })
      this.logger.log(
        `Sent ${type} to=${recipient} log=${logId} messageId=${result.messageId ?? 'log-only'}`,
      )
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
      if (isFinalAttempt) {
        await this.notificationRepo.markFailed(logId, message)
        this.logger.error(
          `Notification ${logId} failed permanently after ${job.attemptsMade + 1} attempts: ${message}`,
        )
      }
      else {
        this.logger.warn(
          `Notification ${logId} attempt ${job.attemptsMade + 1} failed: ${message} — will retry`,
        )
      }
      // Throw để BullMQ retry hoặc move sang failed queue.
      throw new AppException(ResponseCode.NotificationDeliveryFailed, { logId, reason: message })
    }
  }
}
