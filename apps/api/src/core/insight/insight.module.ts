import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AuthModule } from '../auth/auth.module'
import { PublishModule } from '../publish/publish.module'
import { SocialAccountModule } from '../social-account/social-account.module'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'
import { InsightController } from './insight.controller'
import { InsightService } from './insight.service'
import { InsightScheduler } from './insight.scheduler'
import { InsightConsumer } from './insight.consumer'
import { PostInsightRepository } from './post-insight.repository'
import { AccountInsightRepository } from './account-insight.repository'
import { InsightProviderRegistry } from './insight-provider.registry'
import { FacebookInsightProvider } from './providers/facebook-insight.provider'
import { YouTubeInsightProvider } from './providers/youtube-insight.provider'
import { InstagramInsightProvider } from './providers/instagram-insight.provider'
import { TikTokInsightProvider } from './providers/tiktok-insight.provider'

@Module({
  imports: [
    AuthModule,
    PublishModule,
    SocialAccountModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.INSIGHT_SNAPSHOT }),
  ],
  controllers: [InsightController],
  providers: [
    InsightService,
    PostInsightRepository,
    AccountInsightRepository,
    InsightProviderRegistry,
    FacebookInsightProvider,
    YouTubeInsightProvider,
    InstagramInsightProvider,
    TikTokInsightProvider,
    InsightScheduler,
    InsightConsumer,
  ],
  exports: [InsightService],
})
export class InsightModule {}
