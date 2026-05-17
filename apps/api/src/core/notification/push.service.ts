import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import type { PushSubscription } from '@prisma/client'
import * as webpush from 'web-push'
import { APP_CONFIG, type AppConfig } from '../../config'
import { PushSubscriptionRepository } from './push-subscription.repository'

export interface PushPayload {
  title: string
  body: string
  /** URL FE redirect khi user click notification (vd `/inbox?commentId=xxx`) */
  url?: string
  /** Optional tag — browser dùng để dedupe (cùng tag = thay thế notification cũ) */
  tag?: string
  icon?: string
  badge?: string
  /** Extra data forward to FE event handler */
  data?: Record<string, unknown>
}

/**
 * PushService — gửi Web Push notification qua VAPID.
 *
 * Subscription endpoint chứa thông tin browser push service (FCM/Mozilla/etc).
 * Lib `web-push` tự handle ECDH + AES-128-GCM encryption.
 *
 * VAPID keys generate qua `webpush.generateVAPIDKeys()` — set vào env
 * `NOTIFICATION_VAPID_PUBLIC_KEY`, `NOTIFICATION_VAPID_PRIVATE_KEY`.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name)
  private configured = false

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly subscriptionRepo: PushSubscriptionRepository,
  ) {}

  onModuleInit(): void {
    const { vapidPublicKey, vapidPrivateKey, vapidSubject } = this.config.notification
    if (!vapidPublicKey || !vapidPrivateKey) {
      this.logger.warn('VAPID keys chưa cấu hình — push notification disabled (dev mode log-only)')
      return
    }
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
    this.configured = true
    this.logger.log('Push notification provider initialized (VAPID configured)')
  }

  /**
   * Gửi push notification tới 1 subscription.
   * Throw silently — caller dùng `sendToUser()` để fan-out và xử lý batch failure.
   *
   * Browser trả 410 GONE khi subscription expired → xoá khỏi DB.
   */
  async sendToSubscription(subscription: PushSubscription, payload: PushPayload): Promise<boolean> {
    if (!this.configured) {
      this.logger.debug(`[push:skipped] no VAPID — would send to ${subscription.endpoint.slice(0, 40)}…`)
      return false
    }
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
      )
      await this.subscriptionRepo.markUsed(subscription.id)
      return true
    }
    catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        // Subscription expired or unregistered → xoá khỏi DB.
        this.logger.warn(`Push subscription ${subscription.id} expired (${statusCode}) — removing`)
        await this.subscriptionRepo.deleteById(subscription.id).catch(() => undefined)
        return false
      }
      this.logger.error(
        `Push send failed (status=${statusCode}) for subscription ${subscription.id}`,
        err instanceof Error ? err.stack : String(err),
      )
      return false
    }
  }

  /**
   * Fan-out push tới tất cả subscription của user. Không throw — best-effort.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<{ total: number, succeeded: number }> {
    const subs = await this.subscriptionRepo.listByUserId(userId)
    if (subs.length === 0) return { total: 0, succeeded: 0 }

    const results = await Promise.allSettled(
      subs.map(sub => this.sendToSubscription(sub, payload)),
    )
    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value === true).length
    this.logger.log(`Push fan-out user=${userId}: ${succeeded}/${subs.length} delivered`)
    return { total: subs.length, succeeded }
  }
}
