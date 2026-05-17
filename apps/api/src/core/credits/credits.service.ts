import { Inject, Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import type {
  CreditTransaction,
  CreditTransactionType,
  PlanTier,
  Prisma,
  User,
} from '@prisma/client'
import { Prisma as PrismaNS } from '@prisma/client'
import { AppException, ResponseCode, type PaginationDto } from '@sociflow/common'
import { RequestContextService } from '@sociflow/auth'
import { APP_CONFIG, type AppConfig } from '../../config'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'
import { UserService } from '../user/user.service'
import { CreditsRepository } from './credits.repository'
import {
  CREDIT_LOW_EVENT,
  PLAN_LOW_BALANCE_THRESHOLD,
  PLAN_MONTHLY_CREDITS,
  type CreditLowEvent,
  type CreditsPurchaseJob,
  type CreditsRefundJob,
} from './credits.constants'

/**
 * Service quản lý credit ledger + Stripe checkout orchestration.
 *
 * Quy tắc:
 *  - Mọi mutation aiCredits đi qua `applyTransaction` (atomic + audit row).
 *  - Idempotent qua stripeEventId unique — duplicate Stripe webhook = no-op.
 *  - Emit `credit.low` event khi balance sau consume < 20% plan allowance.
 *
 * Service KHÔNG tự verify Stripe signature — WebhookController làm trước rồi enqueue.
 * Service cũng KHÔNG init Stripe SDK ở đây — chỉ controller cần (cho checkout).
 */
@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name)

  constructor(
    private readonly repo: CreditsRepository,
    private readonly ctx: RequestContextService,
    private readonly userService: UserService,
    private readonly events: EventEmitter2,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectQueue(QUEUE_NAMES.CREDITS_PURCHASE) private readonly purchaseQueue: Queue<CreditsPurchaseJob>,
    @InjectQueue(QUEUE_NAMES.CREDITS_REFUND) private readonly refundQueue: Queue<CreditsRefundJob>,
  ) {}

  async getBalance(userId: string): Promise<{ user: User, monthlyAllowance: number }> {
    const user = await this.userService.getById(userId)
    const monthlyAllowance = PLAN_MONTHLY_CREDITS[user.planTier]
    return { user, monthlyAllowance }
  }

  async getBalanceForCurrent(): Promise<{ user: User, monthlyAllowance: number }> {
    const userId = this.ctx.requireUserId()
    return this.getBalance(userId)
  }

  async listHistoryForCurrent(pagination: PaginationDto) {
    const userId = this.ctx.requireUserId()
    return this.repo.listByUserWithPagination(userId, pagination)
  }

  /**
   * Cấp credit cho user (positive amount). Idempotent qua stripeEventId nếu set.
   *
   * Trả `null` nếu Stripe event đã xử lý (duplicate) — caller tự log skip.
   */
  async grant(params: {
    userId: string
    amount: number
    type: CreditTransactionType
    reason?: string
    stripeEventId?: string
    stripeInvoiceId?: string
    metadata?: Prisma.InputJsonValue
  }): Promise<CreditTransaction | null> {
    if (params.amount <= 0) {
      throw new AppException(ResponseCode.ValidationFailed, { reason: 'grant.amount must be > 0' })
    }
    try {
      const { tx } = await this.repo.applyTransaction({
        userId: params.userId,
        amount: params.amount,
        type: params.type,
        reason: params.reason,
        stripeEventId: params.stripeEventId,
        stripeInvoiceId: params.stripeInvoiceId,
        metadata: params.metadata,
      })
      this.logger.log(
        `Granted ${params.amount} credits to user ${params.userId} (type=${params.type}, reason=${params.reason ?? 'n/a'})`,
      )
      return tx
    } catch (err) {
      if (this.isUniqueViolation(err) && params.stripeEventId) {
        this.logger.warn(`Stripe event ${params.stripeEventId} đã xử lý trước — skip duplicate grant`)
        return null
      }
      throw err
    }
  }

  /**
   * Trừ credit user (business consume — AI gen, caption, ...).
   *
   * Atomic check-and-decrement qua prisma transaction để chống race.
   * Throw InsufficientCredits nếu balance < amount.
   */
  async consume(params: {
    userId: string
    amount: number
    reason: string
    metadata?: Prisma.InputJsonValue
  }): Promise<{ tx: CreditTransaction, user: User }> {
    if (params.amount <= 0) {
      throw new AppException(ResponseCode.ValidationFailed, { reason: 'consume.amount must be > 0' })
    }
    const user = await this.userService.getById(params.userId)
    if (user.aiCredits < params.amount) {
      throw new AppException(ResponseCode.InsufficientCredits, {
        userId: params.userId,
        required: params.amount,
        available: user.aiCredits,
      })
    }

    const { tx, user: updatedUser } = await this.repo.applyTransaction({
      userId: params.userId,
      amount: -params.amount,
      type: 'CONSUME',
      reason: params.reason,
      metadata: params.metadata,
    })

    this.maybeEmitLowBalance(updatedUser)
    return { tx, user: updatedUser }
  }

  /**
   * Pre-flight check: user có đủ credit không. Throw `InsufficientCredits` nếu không.
   * Tách ra để caller assert sớm trước khi gọi external API (vd OpenAI) tránh waste call.
   */
  async assertBalance(userId: string, required: number): Promise<void> {
    const user = await this.userService.getById(userId)
    if (user.aiCredits < required) {
      throw new AppException(ResponseCode.InsufficientCredits, {
        userId,
        required,
        available: user.aiCredits,
      })
    }
  }

  /**
   * Trả lại credit user (Stripe refund, dispute). Idempotent qua stripeEventId.
   * `amount` positive — refund-in.
   */
  async refund(params: {
    userId: string
    amount: number
    reason: string
    stripeEventId?: string
    stripeInvoiceId?: string
    metadata?: Prisma.InputJsonValue
  }): Promise<CreditTransaction | null> {
    if (params.amount <= 0) {
      throw new AppException(ResponseCode.ValidationFailed, { reason: 'refund.amount must be > 0' })
    }
    try {
      const { tx } = await this.repo.applyTransaction({
        userId: params.userId,
        // Refund của Stripe → user trả lại tiền → revoke credit (negative).
        amount: -params.amount,
        type: 'REFUND',
        reason: params.reason,
        stripeEventId: params.stripeEventId,
        stripeInvoiceId: params.stripeInvoiceId,
        metadata: params.metadata,
      })
      this.logger.log(`Refunded ${params.amount} credits from user ${params.userId} (reason=${params.reason})`)
      return tx
    } catch (err) {
      if (this.isUniqueViolation(err) && params.stripeEventId) {
        this.logger.warn(`Stripe refund event ${params.stripeEventId} đã xử lý — skip duplicate`)
        return null
      }
      throw err
    }
  }

  /**
   * Enqueue BullMQ purchase job — gọi từ WebhookController khi Stripe checkout/invoice succeeded.
   *
   * Consumer (`CreditsPurchaseConsumer`) sẽ gọi `grant()` async để không block webhook ack.
   */
  async enqueuePurchase(job: CreditsPurchaseJob): Promise<void> {
    await this.purchaseQueue.add('purchase', job, {
      jobId: job.stripeEventId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
    })
  }

  async enqueueRefund(job: CreditsRefundJob): Promise<void> {
    await this.refundQueue.add('refund', job, {
      jobId: job.stripeEventId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
    })
  }

  /**
   * Dispatch Stripe webhook event → enqueue queue job.
   *
   * Mapping chính:
   *  - checkout.session.completed       → CREDITS_PURCHASE
   *  - invoice.payment_succeeded        → CREDITS_PURCHASE (renewal)
   *  - charge.refunded                  → CREDITS_REFUND
   *  - customer.subscription.deleted    → handleSubscriptionDeleted (sync)
   *
   * Type của event là unknown (Stripe.Event runtime) — service không import Stripe types
   * vì service cần test được không cần SDK. WebhookController đã parse + verify.
   */
  async dispatchStripeEvent(event: {
    id: string
    type: string
    data: { object: Record<string, unknown> }
  }): Promise<void> {
    const obj = event.data.object
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.id, obj)
        return
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaid(event.id, obj)
        return
      case 'charge.refunded':
        await this.handleChargeRefunded(event.id, obj)
        return
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(obj)
        return
      default:
        this.logger.debug(`Bỏ qua Stripe event type=${event.type}`)
    }
  }

  private async handleCheckoutCompleted(eventId: string, obj: Record<string, unknown>): Promise<void> {
    const userId = this.extractUserId(obj)
    const credits = this.extractCredits(obj)
    if (!userId || !credits) {
      this.logger.warn(`Stripe checkout.session.completed missing userId/credits in metadata — event ${eventId}`)
      return
    }
    const planTier = this.extractPlanTier(obj)
    await this.enqueuePurchase({
      stripeEventId: eventId,
      stripeInvoiceId: typeof obj.invoice === 'string' ? obj.invoice : undefined,
      userId,
      amount: credits,
      reason: 'stripe_checkout',
      planTier,
      metadata: { sessionId: typeof obj.id === 'string' ? obj.id : undefined },
    })
  }

  private async handleInvoicePaid(eventId: string, obj: Record<string, unknown>): Promise<void> {
    const userId = this.extractUserId(obj)
    const credits = this.extractCredits(obj)
    if (!userId || !credits) {
      this.logger.warn(`Stripe invoice.payment_succeeded missing metadata — event ${eventId}`)
      return
    }
    await this.enqueuePurchase({
      stripeEventId: eventId,
      stripeInvoiceId: typeof obj.id === 'string' ? obj.id : undefined,
      userId,
      amount: credits,
      reason: 'stripe_invoice_paid',
    })
  }

  private async handleChargeRefunded(eventId: string, obj: Record<string, unknown>): Promise<void> {
    const userId = this.extractUserId(obj)
    const credits = this.extractCredits(obj)
    if (!userId || !credits) {
      this.logger.warn(`Stripe charge.refunded missing metadata — event ${eventId}`)
      return
    }
    await this.enqueueRefund({
      stripeEventId: eventId,
      stripeChargeId: typeof obj.id === 'string' ? obj.id : '',
      userId,
      amount: credits,
      reason: 'stripe_refund',
    })
  }

  private async handleSubscriptionDeleted(obj: Record<string, unknown>): Promise<void> {
    const userId = this.extractUserId(obj)
    if (!userId) return
    this.logger.log(`Stripe subscription deleted for user ${userId} — downgrade to FREE (TODO: wire UserService.update)`)
    // NOTE: UserService chưa expose method `updatePlan`. Để Agent quản lý user implement
    // hoặc Agent F4 (pricing UI) wire endpoint admin. Hiện chỉ log.
  }

  private maybeEmitLowBalance(user: User): void {
    const allowance = PLAN_MONTHLY_CREDITS[user.planTier]
    if (allowance === 0) return
    const ratio = user.aiCredits / allowance
    if (ratio < PLAN_LOW_BALANCE_THRESHOLD) {
      const payload: CreditLowEvent = {
        userId: user.id,
        remainingCredits: user.aiCredits,
        threshold: Math.floor(allowance * PLAN_LOW_BALANCE_THRESHOLD),
        planTier: user.planTier,
      }
      this.events.emit(CREDIT_LOW_EVENT, payload)
      this.logger.warn(
        `User ${user.id} balance ${user.aiCredits} dưới ngưỡng ${payload.threshold} (plan ${user.planTier})`,
      )
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return err instanceof PrismaNS.PrismaClientKnownRequestError && err.code === 'P2002'
  }

  private extractUserId(obj: Record<string, unknown>): string | null {
    const meta = obj.metadata as Record<string, unknown> | undefined
    const candidate = meta?.userId
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
  }

  private extractCredits(obj: Record<string, unknown>): number | null {
    const meta = obj.metadata as Record<string, unknown> | undefined
    const candidate = meta?.credits
    const num = typeof candidate === 'string' ? Number.parseInt(candidate, 10)
      : typeof candidate === 'number' ? candidate
        : Number.NaN
    return Number.isFinite(num) && num > 0 ? num : null
  }

  private extractPlanTier(obj: Record<string, unknown>): PlanTier | undefined {
    const meta = obj.metadata as Record<string, unknown> | undefined
    const candidate = meta?.planTier
    if (candidate === 'PRO' || candidate === 'BUSINESS' || candidate === 'ENTERPRISE') {
      return candidate
    }
    return undefined
  }
}
