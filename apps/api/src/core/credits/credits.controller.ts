import { Body, Controller, Get, Inject, Logger, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { ApiDoc, AppException, type AuthUser, CurrentUser, ResponseCode } from '@sociflow/common'
import Stripe from 'stripe'
import { APP_CONFIG, type AppConfig } from '../../config'
import { UserService } from '../user/user.service'
import { CreditsService } from './credits.service'
import {
  CheckoutSessionDto,
  CheckoutSessionDtoSchema,
  ListHistoryDto,
  ListHistoryDtoSchema,
} from './credits.dto'
import {
  CheckoutSessionVo,
  CreditBalanceVo,
  CreditTransactionListVo,
  CreditTransactionVo,
} from './credits.vo'

@ApiTags('Credits')
@ApiBearerAuth()
@Controller('/credits')
export class CreditsController {
  private readonly stripe: Stripe
  private readonly logger = new Logger(CreditsController.name)

  constructor(
    private readonly credits: CreditsService,
    private readonly userService: UserService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2026-04-22.dahlia' })
  }

  @ApiDoc({
    summary: 'Số credit hiện tại + plan info',
    response: CreditBalanceVo,
  })
  @Get('/balance')
  async getBalance(@CurrentUser() user: AuthUser) {
    const { user: entity, monthlyAllowance } = await this.credits.getBalance(user.id)
    return CreditBalanceVo.create({ user: entity, monthlyAllowance })
  }

  @ApiDoc({
    summary: 'Lịch sử giao dịch credit (ledger)',
    query: ListHistoryDtoSchema,
    response: CreditTransactionListVo,
  })
  @Get('/history')
  async listHistory(@Query() query: ListHistoryDto) {
    const result = await this.credits.listHistoryForCurrent({
      page: query.page,
      pageSize: query.pageSize,
    })
    return new CreditTransactionListVo({
      list: result.list.map(CreditTransactionVo.create),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  }

  @ApiDoc({
    summary: 'Cancel subscription hiện tại — Stripe cancel at_period_end',
  })
  @Throttle({ default: { limit: 3, ttl: 3600_000 } })
  @Post('/cancel-subscription')
  async cancelSubscription(@CurrentUser() user: AuthUser): Promise<{ ok: true, cancelAt: string | null }> {
    const fullUser = await this.userService.getById(user.id)
    const stripeCustomerId = (fullUser as { stripeCustomerId?: string | null }).stripeCustomerId
    if (!stripeCustomerId) {
      throw new AppException(ResponseCode.StripeCheckoutFailed, { reason: 'no_stripe_customer' })
    }
    // List active subscriptions của customer, cancel cái đầu tiên (1 user = 1 sub)
    const subs = await this.stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
    })
    if (subs.data.length === 0) {
      return { ok: true, cancelAt: null }
    }
    const cancelled = await this.stripe.subscriptions.update(subs.data[0].id, {
      cancel_at_period_end: true,
    })
    this.logger.log(`User ${user.id} subscription ${cancelled.id} cancel at period end`)
    return {
      ok: true,
      cancelAt: cancelled.cancel_at ? new Date(cancelled.cancel_at * 1000).toISOString() : null,
    }
  }

  @ApiDoc({
    summary: 'Tạo Stripe Checkout session — FE redirect window.location tới `url`',
    body: CheckoutSessionDtoSchema,
    response: CheckoutSessionVo,
  })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('/checkout-session')
  async createCheckoutSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckoutSessionDto,
  ): Promise<CheckoutSessionVo> {
    try {
      const session = dto.mode === 'subscription'
        ? await this.createSubscriptionSession(user, dto)
        : await this.createPaymentSession(user, dto)
      return CheckoutSessionVo.create(session)
    } catch (err) {
      if (err instanceof AppException) throw err
      throw new AppException(ResponseCode.StripeCheckoutFailed, {
        reason: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  private async createPaymentSession(
    user: AuthUser,
    dto: CheckoutSessionDto,
  ): Promise<Stripe.Checkout.Session> {
    const credits = dto.credits!
    const unitAmount = this.config.stripe.pricePerCredit
    return this.stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: dto.successUrl ?? this.config.stripe.successUrl,
      cancel_url: dto.cancelUrl ?? this.config.stripe.cancelUrl,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        credits: String(credits),
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: unitAmount,
            product_data: { name: `${credits} Sociflow credits` },
          },
          quantity: credits,
        },
      ],
    })
  }

  private async createSubscriptionSession(
    user: AuthUser,
    dto: CheckoutSessionDto,
  ): Promise<Stripe.Checkout.Session> {
    const planTier = dto.planTier!
    const priceId = this.priceIdForPlan(planTier)
    if (!priceId) {
      throw new AppException(ResponseCode.StripeCheckoutFailed, {
        reason: `Missing Stripe price ID for plan ${planTier}`,
      })
    }
    return this.stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: dto.successUrl ?? this.config.stripe.successUrl,
      cancel_url: dto.cancelUrl ?? this.config.stripe.cancelUrl,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        planTier,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planTier,
        },
      },
      line_items: [{ price: priceId, quantity: 1 }],
    })
  }

  private priceIdForPlan(planTier: 'PRO' | 'BUSINESS' | 'ENTERPRISE'): string {
    if (planTier === 'PRO') return this.config.stripe.planPriceIds.pro
    if (planTier === 'BUSINESS') return this.config.stripe.planPriceIds.business
    return this.config.stripe.planPriceIds.enterprise
  }
}
