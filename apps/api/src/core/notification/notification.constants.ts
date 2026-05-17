/**
 * Constants + types riêng cho Notification module.
 *
 * Queue NOTIFICATION dùng để buffer + retry email send. Producer = NotificationService,
 * Consumer = NotificationConsumer (Resend API call).
 */
import type { AccountPlatform, NotificationType } from '@prisma/client'
import type { PushPayload } from './push.service'

export const NOTIFICATION_QUEUE = 'notification'
export const NOTIFICATION_SEND_JOB = 'notification.send'

/**
 * Event constants — Notification module subscribe các domain event sau qua @OnEvent.
 * Module emit (auth/publish/credits/social-account) chỉ cần emit event đúng tên + shape.
 */
export const NOTIFICATION_EVENTS = {
  USER_REGISTERED: 'auth.user-registered',
  PASSWORD_RESET_REQUESTED: 'auth.password-reset-requested',
  PUBLISH_FAILED: 'publish.failed',
  CREDENTIAL_EXPIRING: 'credential.expiring',
  CREDIT_LOW: 'credit.low',
  /** Mirror Comment domain `comment.new` — string trùng với COMMENT_NEW_EVENT */
  COMMENT_NEW: 'comment.new',
} as const

/** Payload `auth.user-registered` */
export interface UserRegisteredEventPayload {
  userId: string
  email: string
  name: string | null
  /** Verify URL đầy đủ (đã sign JWT) — AuthService build trước khi emit */
  verifyUrl: string
  /** Khi nào link expire (ISO date) */
  expireAt: Date
}

/** Payload `auth.password-reset-requested` */
export interface PasswordResetRequestedEventPayload {
  userId: string
  email: string
  name: string | null
  resetUrl: string
  expireAt: Date
}

/** Payload `publish.failed` — emit từ PublishConsumer khi mark FAILED final. */
export interface PublishFailedEventPayload {
  publishRecordId: string
  userId: string
  platform: string
  postTitle: string | null
  errorMessage: string
}

/**
 * Payload `credential.expiring` — emit từ scheduler check token sắp/đã hết hạn.
 * Agent F6 (credential lifecycle) emit event này khi:
 *  - Detect tokenExpiresAt < now (đã hết hạn) HOẶC
 *  - Refresh API trả lỗi không recoverable.
 */
export interface CredentialExpiringEventPayload {
  userId: string
  accountId: string
  platform: string
  accountDisplayName: string
}

/**
 * Payload `credit.low` — emit từ CreditsService sau khi consume nếu balanceAfter < threshold.
 * Agent F3 (credits) responsible for emitting.
 */
export interface CreditLowEventPayload {
  userId: string
  remainingCredits: number
  threshold: number
}

/**
 * Job payload đẩy vào queue NOTIFICATION. Consumer load template + send Resend.
 */
export interface NotificationSendJob {
  /** NotificationLog.id pre-created với status QUEUED — consumer update SENT|FAILED */
  logId: string
  type: NotificationType
  recipient: string
  /** Per-template payload — JSON-serializable, consumer cast theo `type` */
  templateData: Record<string, unknown>
}

/**
 * Payload `comment.new` — emit từ CommentService khi ingest comment lần đầu.
 * Mirror `CommentNewEventPayload` ở comment.events.ts để Notification không
 * cross-import từ Comment module.
 */
export interface CommentNewEventPayload {
  commentId: string
  userId: string
  accountId: string
  platform: AccountPlatform
}

/**
 * Params cho `NotificationService.notifyUser()` — multi-channel entry.
 * Hiện chỉ wire `push`. Future: `email`, `inApp` channels.
 */
export interface NotifyUserParams {
  userId: string
  push?: PushPayload
}
