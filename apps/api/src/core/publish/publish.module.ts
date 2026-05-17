import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AuthModule } from '../auth/auth.module'
import { MediaModule } from '../media/media.module'
import { SocialAccountModule } from '../social-account/social-account.module'
import { AgentWsModule } from '../agent/ws/agent-ws.module'
import { ApiKeyModule } from '../api-key/api-key.module'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'
import { PublishController } from './publish.controller'
import { PublishRepository } from './publish.repository'
import { PublishService } from './publish.service'
import { PublishConsumer } from './publish.consumer'
import { PublishProviderRegistry } from './publish-provider.registry'
import { YouTubeProvider } from './providers/youtube.provider'
import { FacebookProvider } from './providers/facebook.provider'
import { InstagramProvider } from './providers/instagram.provider'
import { TikTokProvider } from './providers/tiktok.provider'

@Module({
  imports: [
    AuthModule,
    SocialAccountModule,
    MediaModule,
    AgentWsModule,                    // AgentDispatcherService + AutomationTaskService cho AUTOMATION mode
    ApiKeyModule,                     // ApiKeyAuthGuard cho dual-auth controller
    BullModule.registerQueue({ name: QUEUE_NAMES.PUBLISH_IMMEDIATE }),
  ],
  controllers: [PublishController],
  providers: [
    PublishService,
    PublishRepository,
    PublishConsumer,
    PublishProviderRegistry,
    YouTubeProvider,
    FacebookProvider,
    InstagramProvider,
    TikTokProvider,
  ],
  exports: [PublishService],
})
export class PublishModule {}
