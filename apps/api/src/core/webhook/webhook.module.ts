import { Module } from '@nestjs/common'
import { CommentModule } from '../comment/comment.module'
import { SocialAccountModule } from '../social-account/social-account.module'
import { WebhookController } from './webhook.controller'
import { WebhookService } from './webhook.service'

@Module({
  imports: [CommentModule, SocialAccountModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
