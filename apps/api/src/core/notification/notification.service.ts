import { Inject, Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { OnEvent } from '@nestjs/event-emitter'
import type { Queue } from 'bullmq'
import { NotificationType } from '@prisma/client'
import { APP_CONFIG, type AppConfig } from '../../config'
import { UserService } from '../user/user.service'
import { EmailService } from './email.service'
import { NotificationRepository } from './notification.repository'
import { PushService, type PushPayload } from './push.service'
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_QUEUE,
  NOTIFICATION_SEND_JOB,
  type CommentNewEventPayload,
  type CredentialExpiringEventPayload,
  type CreditLowEventPayload,
  type NotificationSendJob,
  type NotifyUserParams,
  type PasswordResetRequestedEventPayload,
  type PublishFailedEventPayload,
  type UserRegisteredEventPayload,
} from './notification.constants'

interface SendEmailParams {
  userId: string
  recipient: string
  type: NotificationType
  templateData: Record<string, unknown>
}

/**
 * NotificationService — orchestrate email/push/in-app delivery.
 *
 * Flow:
 *  1. Caller (event handler hoặc service khác) gọi `sendEmail({...})`.
 *  2. Tạo NotificationLog (status QUEUED).
 *  3. Enqueue NOTIFICATION_SEND_JOB với logId + payload.
 *  4. NotificationConsumer pop job → EmailService.sendByType → markSent/markFailed.
 *
 * Event listeners trong cùng class — không sửa code module khác (auth/publish/credits).
 * Module emit chỉ cần `EventEmitter2.emit(NOTIFICATION_EVENTS.X, payload)`.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)

  constructor(
    private readonly notificationRepo: NotificationRepository,
    private readonly userService: UserService,
    private readonly emailService: EmailService,
    private readonly pushService: PushService,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue<NotificationSendJob>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async sendEmail(params: SendEmailParams): Promise<{ logId: string }> {
    const subject = this.emailService.getSubjectFor(params.type)
    const log = await this.notificationRepo.create({
      userId: params.userId,
      type: params.type,
      channel: 'email',
      recipient: params.recipient,
      subject,
      templateName: params.type,
    })

    await this.queue.add(
      NOTIFICATION_SEND_JOB,
      {
        logId: log.id,
        type: params.type,
        recipient: params.recipient,
        templateData: params.templateData,
      },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    )
    this.logger.log(
      `Enqueued ${params.type} email log=${log.id} to=${params.recipient}`,
    )
    return { logId: log.id }
  }

  /**
   * Push notification — Web Push API (VAPID). Fan-out tới mọi subscription
   * của user. Best-effort: 1 device fail không stop khác (PushService handle).
   */
  async sendPush(userId: string, payload: PushPayload): Promise<{ total: number, succeeded: number }> {
    return this.pushService.sendToUser(userId, payload)
  }

  /**
   * notifyUser — multi-channel entry point. Hiện wire `push`. Email vẫn
   * dùng `sendEmail()` riêng (cần template). Future: chọn channel theo
   * user preference.
   */
  async notifyUser(params: NotifyUserParams): Promise<void> {
    const { userId, push } = params
    if (push) {
      await this.pushService.sendToUser(userId, push)
    }
  }

  /**
   * In-app notification placeholder — Phase 8+ (WS push hoặc poll endpoint).
   */
  async sendInApp(): Promise<void> {
    this.logger.debug('sendInApp() — chưa implement (Phase 8+)')
  }

  // ============================================================
  // Event listeners — subscribe domain event, không sửa module khác
  // ============================================================

  @OnEvent(NOTIFICATION_EVENTS.USER_REGISTERED, { async: true })
  async onUserRegistered(payload: UserRegisteredEventPayload): Promise<void> {
    await this.sendEmail({
      userId: payload.userId,
      recipient: payload.email,
      type: NotificationType.EMAIL_VERIFY,
      templateData: {
        name: payload.name ?? payload.email,
        verifyUrl: payload.verifyUrl,
        expireAt: payload.expireAt,
      },
    })
  }

  @OnEvent(NOTIFICATION_EVENTS.PASSWORD_RESET_REQUESTED, { async: true })
  async onPasswordResetRequested(payload: PasswordResetRequestedEventPayload): Promise<void> {
    await this.sendEmail({
      userId: payload.userId,
      recipient: payload.email,
      type: NotificationType.EMAIL_RESET,
      templateData: {
        name: payload.name ?? payload.email,
        resetUrl: payload.resetUrl,
        expireAt: payload.expireAt,
      },
    })
  }

  /**
   * Lookup user nhưng return null thay vì throw — dùng cho event handler,
   * không muốn break event listener nếu user đã bị xoá.
   */
  private async loadUserSafe(userId: string): Promise<{ id: string, email: string, name: string | null } | null> {
    try {
      const user = await this.userService.getById(userId)
      return { id: user.id, email: user.email, name: user.name }
    }
    catch {
      return null
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.PUBLISH_FAILED, { async: true })
  async onPublishFailed(payload: PublishFailedEventPayload): Promise<void> {
    const user = await this.loadUserSafe(payload.userId)
    if (!user) {
      this.logger.warn(`PUBLISH_FAILED event for unknown user ${payload.userId}`)
      return
    }
    const retryUrl = `${this.config.notification.appUrl}/publish/${payload.publishRecordId}`
    await this.sendEmail({
      userId: user.id,
      recipient: user.email,
      type: NotificationType.EMAIL_PUBLISH_FAILED,
      templateData: {
        name: user.name ?? user.email,
        platform: payload.platform,
        postTitle: payload.postTitle,
        errorMessage: payload.errorMessage,
        publishRecordId: payload.publishRecordId,
        retryUrl,
      },
    })
  }

  @OnEvent(NOTIFICATION_EVENTS.CREDENTIAL_EXPIRING, { async: true })
  async onCredentialExpiring(payload: CredentialExpiringEventPayload): Promise<void> {
    const user = await this.loadUserSafe(payload.userId)
    if (!user) {
      this.logger.warn(`CREDENTIAL_EXPIRING event for unknown user ${payload.userId}`)
      return
    }
    const reconnectUrl = `${this.config.notification.appUrl}/settings/accounts/${payload.accountId}`
    await this.sendEmail({
      userId: user.id,
      recipient: user.email,
      type: NotificationType.EMAIL_ACCOUNT_EXPIRED,
      templateData: {
        name: user.name ?? user.email,
        platform: payload.platform,
        accountDisplayName: payload.accountDisplayName,
        reconnectUrl,
      },
    })
  }

  @OnEvent(NOTIFICATION_EVENTS.CREDIT_LOW, { async: true })
  async onCreditLow(payload: CreditLowEventPayload): Promise<void> {
    const user = await this.loadUserSafe(payload.userId)
    if (!user) {
      this.logger.warn(`CREDIT_LOW event for unknown user ${payload.userId}`)
      return
    }
    const topUpUrl = `${this.config.notification.appUrl}/billing`
    await this.sendEmail({
      userId: user.id,
      recipient: user.email,
      type: NotificationType.EMAIL_CREDIT_LOW,
      templateData: {
        name: user.name ?? user.email,
        remainingCredits: payload.remainingCredits,
        threshold: payload.threshold,
        topUpUrl,
      },
    })
  }

  /**
   * Comment mới từ platform → push notification cho user.
   * Email vẫn giữ cho các sự kiện critical khác — comment volume cao
   * nên chỉ push (không spam mailbox).
   */
  @OnEvent(NOTIFICATION_EVENTS.COMMENT_NEW, { async: true })
  async onCommentNew(payload: CommentNewEventPayload): Promise<void> {
    const inboxUrl = `${this.config.notification.appUrl}/inbox?commentId=${payload.commentId}`
    await this.pushService.sendToUser(payload.userId, {
      title: 'Comment mới',
      body: `${payload.platform}: có comment chưa trả lời`,
      url: inboxUrl,
      tag: `comment-${payload.commentId}`,
      data: {
        commentId: payload.commentId,
        accountId: payload.accountId,
        platform: payload.platform,
      },
    })
  }
}
