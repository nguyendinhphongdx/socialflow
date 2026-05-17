import type { PlanTier } from '@prisma/client'

/**
 * Constants riêng cho Credits module.
 *
 * Event `credit.low` được emit từ CreditsService khi user balance sau consume
 * còn dưới ngưỡng PLAN_LOW_BALANCE_THRESHOLD * plan allowance.
 *
 * Notification module (Agent F5) lắng nghe event để gửi mail / in-app nudge.
 */

export const CREDIT_LOW_EVENT = 'credit.low'

/// BullMQ job names cho 2 queue Stripe-driven.
export const CREDITS_PURCHASE_JOB_NAME = 'credits-purchase'
export const CREDITS_REFUND_JOB_NAME = 'credits-refund'

/**
 * Số credit mặc định cấp lại mỗi tháng theo plan tier.
 * - Free: 100 credit (cấp 1 lần khi tạo account, không renew tự động)
 * - Pro: 5000 / tháng
 * - Business: 20000 / tháng
 * - Enterprise: 100000 / tháng (negotiate)
 */
export const PLAN_MONTHLY_CREDITS: Record<PlanTier, number> = {
  FREE: 100,
  PRO: 5000,
  BUSINESS: 20000,
  ENTERPRISE: 100000,
}

/**
 * Ngưỡng % balance (so với plan allowance) để emit `credit.low` event.
 * Vd: PRO plan 5000 credits, balance < 1000 (20%) → emit nudge.
 */
export const PLAN_LOW_BALANCE_THRESHOLD = 0.2

/**
 * Event payload `credit.low`. Notification service consume để gửi nudge user.
 */
export interface CreditLowEvent {
  userId: string
  remainingCredits: number     // align với NotificationService.CreditLowEventPayload
  threshold: number
  planTier: PlanTier
}

/**
 * BullMQ job payload cho CREDITS_PURCHASE queue.
 * Producer: WebhookController khi nhận Stripe event.
 * Consumer: CreditsPurchaseConsumer xác thực + grant credit (idempotent qua stripeEventId).
 */
export interface CreditsPurchaseJob {
  /// Stripe event ID — primary idempotency key.
  stripeEventId: string
  stripeInvoiceId?: string
  userId: string
  amount: number
  reason: string
  /// Plan tier nếu purchase là subscription (upgrade user.planTier).
  planTier?: PlanTier
  metadata?: Record<string, unknown>
}

/**
 * BullMQ job payload cho CREDITS_REFUND queue.
 * Producer: Stripe webhook `charge.refunded`.
 */
export interface CreditsRefundJob {
  stripeEventId: string
  stripeChargeId: string
  userId: string
  /// Số credit cần thu hồi (positive number — service tự convert sang negative trong ledger).
  amount: number
  reason: string
  metadata?: Record<string, unknown>
}
