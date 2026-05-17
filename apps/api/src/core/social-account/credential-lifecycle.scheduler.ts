import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { SocialAccount } from '@prisma/client'
import { SocialAccountRepository } from './social-account.repository'

const EXPIRING_LEAD_MS = 3 * 24 * 3600 * 1000 // 3 ngày trước expire
const BATCH_SIZE = 200

/**
 * F-711 — Credential lifecycle daily scan.
 *
 * Mỗi 6h: tìm social accounts có `tokenExpiresAt` trong 3 ngày tới + chưa
 * gửi alert gần đây → emit `credential.expiring` event → NotificationService
 * gửi `AccountExpiredEmail` cho user.
 *
 * State machine:
 *   ACTIVE → (3 ngày trước expire) → EXPIRING (alert) → TOKEN_EXPIRED → DISCONNECTED
 *
 * - EXPIRING: emit event 1 lần / token / chu kỳ
 * - TOKEN_EXPIRED: mark khi token thật sự hết hạn HOẶC refresh fail không
 *   recoverable (xử lý trong TokenRefreshConsumer — out of scope scheduler này)
 * - DISCONNECTED: user explicit revoke (xử lý qua softDelete)
 *
 * Idempotent qua field `expiringAlertSentAt` (cập nhật mỗi lần emit) —
 * không emit lại trong 7 ngày kể từ alert trước.
 */
@Injectable()
export class CredentialLifecycleScheduler {
  private readonly logger = new Logger(CredentialLifecycleScheduler.name)

  constructor(
    private readonly repo: SocialAccountRepository,
    private readonly events: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS, { name: 'credential-lifecycle-scan' })
  async scanExpiring(): Promise<void> {
    const cutoff = new Date(Date.now() + EXPIRING_LEAD_MS)
    const accounts = await this.repo.listExpiringTokens(cutoff, BATCH_SIZE)
    if (accounts.length === 0) return

    let alertedCount = 0
    for (const account of accounts) {
      const shouldAlert = this.shouldEmitAlert(account)
      if (!shouldAlert) continue

      this.events.emit('credential.expiring', {
        userId: account.userId,
        accountId: account.id,
        platform: account.platform,
        accountDisplayName: account.displayName,
      })
      // Mark alert sent — repository field `expiringAlertSentAt` cần có trong schema
      // Nếu chưa có, dùng `lastSyncAt` làm proxy hoặc skip mark (acceptable cho v1)
      await this.markAlertSent(account.id)
      alertedCount += 1
    }

    if (alertedCount > 0) {
      this.logger.log(`Emitted credential.expiring cho ${alertedCount}/${accounts.length} accounts`)
    }
  }

  /**
   * Idempotent guard: emit chỉ nếu chưa alert trong 7 ngày (chống email spam).
   * Hiện dùng `lastSyncAt` proxy — chuẩn hơn cần thêm field riêng `expiringAlertSentAt`.
   */
  private shouldEmitAlert(account: SocialAccount): boolean {
    if (account.status !== 'ACTIVE') return false
    if (!account.tokenExpiresAt) return false

    // Nếu account đã có metadata.expiringAlertSentAt < 7 ngày → skip
    const metadata = (account.metadata ?? {}) as { expiringAlertSentAt?: string }
    if (metadata.expiringAlertSentAt) {
      const sentAt = new Date(metadata.expiringAlertSentAt)
      const daysSince = (Date.now() - sentAt.getTime()) / 86_400_000
      if (daysSince < 7) return false
    }
    return true
  }

  private async markAlertSent(accountId: string): Promise<void> {
    // Lấy current metadata trước rồi merge
    const current = await this.repo.getById(accountId)
    if (!current) return
    const metadata = {
      ...((current.metadata ?? {}) as Record<string, unknown>),
      expiringAlertSentAt: new Date().toISOString(),
    }
    await this.repo.updateById(accountId, { metadata })
  }
}
