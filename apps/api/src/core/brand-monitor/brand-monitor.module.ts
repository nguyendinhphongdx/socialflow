import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AuthModule } from '../auth/auth.module'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'
import { BrandMonitorController } from './brand-monitor.controller'
import { BrandMonitorRepository } from './brand-monitor.repository'
import { BrandMonitorScheduler } from './brand-monitor.scheduler'
import { BrandMonitorService } from './brand-monitor.service'
import { BrandMentionRepository } from './brand-mention.repository'
import { BrandMentionController } from './brand-mention.controller'
import { BrandSentimentConsumer } from './brand-sentiment.consumer'

/**
 * BrandMonitor module — Phase 6 polish:
 *  - CRUD brand monitor (keyword + schedule)
 *  - Persist BrandMention (idempotent upsert)
 *  - Sentiment classification async qua BRAND_SENTIMENT queue → apps/ai
 *
 * AiClientService inject từ @Global AiClientModule (apps/api/libs/ai-client).
 */
@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.BRAND_SENTIMENT }),
  ],
  controllers: [BrandMonitorController, BrandMentionController],
  providers: [
    BrandMonitorService,
    BrandMonitorRepository,
    BrandMonitorScheduler,
    BrandMentionRepository,
    BrandSentimentConsumer,
  ],
  exports: [BrandMonitorService],
})
export class BrandMonitorModule {}
