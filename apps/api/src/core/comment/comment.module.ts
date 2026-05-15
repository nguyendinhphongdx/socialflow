import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { SocialAccountModule } from '../social-account/social-account.module'
import { COMMENT_REPLY_PORT } from '../auto-reply/auto-reply.constants'
import { QUEUE_NAMES } from '../../libs/queue/queue.module'
import { CommentController } from './comment.controller'
import { CommentService } from './comment.service'
import { CommentRepository } from './comment.repository'
import { CommentProviderRegistry } from './providers/comment-provider.registry'
import { FacebookCommentProvider } from './providers/facebook-comment.provider'
import { InstagramCommentProvider } from './providers/instagram-comment.provider'
import { YouTubeCommentProvider } from './providers/youtube-comment.provider'
import { TikTokCommentProvider } from './providers/tiktok-comment.provider'
import { CommentSyncConsumer } from './sync/comment-sync.consumer'
import { TikTokCommentScheduler } from './sync/tiktok-comment.scheduler'
import { YouTubeCommentScheduler } from './sync/youtube-comment.scheduler'

/**
 * CommentModule — engagement Phase 6.
 *
 * Wire:
 *  - REST inbox endpoints (GET/POST/DELETE /comments)
 *  - Reply providers (FB/IG/YT API, TT stub)
 *  - Sync schedulers (TT/YT poll mỗi 15 phút)
 *  - Sync consumer (BullMQ COMMENT_SYNC queue)
 *  - Provide COMMENT_REPLY_PORT cho AutoReplyConsumer
 *
 * FB/IG comments được sync qua webhook (WebhookService → CommentService.ingest).
 */
@Module({
  imports: [
    SocialAccountModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.COMMENT_SYNC }),
  ],
  controllers: [CommentController],
  providers: [
    CommentService,
    CommentRepository,
    CommentProviderRegistry,
    FacebookCommentProvider,
    InstagramCommentProvider,
    YouTubeCommentProvider,
    TikTokCommentProvider,
    CommentSyncConsumer,
    TikTokCommentScheduler,
    YouTubeCommentScheduler,
    {
      provide: COMMENT_REPLY_PORT,
      useExisting: CommentService,
    },
  ],
  exports: [CommentService, COMMENT_REPLY_PORT],
})
export class CommentModule {}
