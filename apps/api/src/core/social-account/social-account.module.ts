import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { AuthModule } from '../auth/auth.module'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'
import { SocialAccountController } from './social-account.controller'
import { SocialAccountRepository } from './social-account.repository'
import { SocialAccountService } from './social-account.service'
import { TokenRefreshConsumer } from './token-refresh.consumer'
import { TokenRefreshScheduler } from './token-refresh.scheduler'
import { CredentialLifecycleScheduler } from './credential-lifecycle.scheduler'
import { YouTubeConnectService } from './youtube-connect.service'
import { FacebookConnectService } from './facebook-connect.service'
import { InstagramConnectService } from './instagram-connect.service'
import { TikTokConnectService } from './tiktok-connect.service'

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.TOKEN_REFRESH }),
  ],
  controllers: [SocialAccountController],
  providers: [
    SocialAccountService,
    SocialAccountRepository,
    YouTubeConnectService,
    FacebookConnectService,
    InstagramConnectService,
    TikTokConnectService,
    TokenRefreshScheduler,
    TokenRefreshConsumer,
    CredentialLifecycleScheduler,
  ],
  exports: [SocialAccountService, YouTubeConnectService, FacebookConnectService, InstagramConnectService, TikTokConnectService],
})
export class SocialAccountModule {}
