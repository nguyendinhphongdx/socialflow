import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'
import { UserModule } from '../user/user.module'
import { CreditsController } from './credits.controller'
import { CreditsService } from './credits.service'
import { CreditsRepository } from './credits.repository'
import { CreditsPurchaseConsumer } from './credits-purchase.consumer'
import { CreditsRefundConsumer } from './credits-refund.consumer'

/**
 * Credits module — quản lý aiCredits ledger + Stripe checkout orchestration.
 *
 * Public surface:
 *  - CreditsController: REST `/credits/balance | history | checkout-session`.
 *  - CreditsService: inject từ module khác (AI, Publish) để `consume()` credit.
 *  - Event `credit.low` (xem credits.events.ts) — Notification module subscribe.
 *
 * Stripe webhook delivery xử lý ở WebhookModule (re-use endpoint chung
 * `/webhook/stripe`) — sau khi verify signature, gọi `CreditsService.dispatchStripeEvent`.
 */
@Module({
  imports: [
    UserModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.CREDITS_PURCHASE },
      { name: QUEUE_NAMES.CREDITS_REFUND },
    ),
  ],
  controllers: [CreditsController],
  providers: [
    CreditsService,
    CreditsRepository,
    CreditsPurchaseConsumer,
    CreditsRefundConsumer,
  ],
  exports: [CreditsService],
})
export class CreditsModule {}
