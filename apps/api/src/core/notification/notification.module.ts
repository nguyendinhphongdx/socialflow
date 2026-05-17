import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { UserModule } from '../user/user.module'
import { NotificationController } from './notification.controller'
import { NotificationService } from './notification.service'
import { NotificationRepository } from './notification.repository'
import { NotificationConsumer } from './notification.consumer'
import { EmailService } from './email.service'
import { PushService } from './push.service'
import { PushSubscriptionRepository } from './push-subscription.repository'
import { PushSubscriptionController } from './push-subscription.controller'
import { NOTIFICATION_QUEUE } from './notification.constants'

/**
 * NotificationModule — F-709 / F-710 / Web Push (Phase 6 polish).
 *
 * Subscribe domain events qua @OnEvent (auth/publish/credits/social-account/comment)
 * → enqueue NOTIFICATION queue (email) hoặc fan-out push (PushService) ngay.
 *
 * Module emit chỉ cần `EventEmitter2.emit(NOTIFICATION_EVENTS.X, payload)`
 * — không import NotificationModule (event-driven, loose coupling).
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
    UserModule,
  ],
  controllers: [NotificationController, PushSubscriptionController],
  providers: [
    NotificationService,
    NotificationRepository,
    NotificationConsumer,
    EmailService,
    PushService,
    PushSubscriptionRepository,
  ],
  exports: [NotificationService, PushService],
})
export class NotificationModule {}
