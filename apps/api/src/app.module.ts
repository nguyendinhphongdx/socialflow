import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ContextModule } from '@sociflow/auth'
import { AppConfigModule } from './config'
import { DatabaseModule } from './libs/database/database.module'
import { AppLoggerModule } from './libs/logger/logger.module'
import { AiClientModule } from './libs/ai-client/ai-client.module'
import { QueueModule } from './libs/queue/queue.module'
import { StorageWireModule } from './libs/storage/storage-wire.module'
import { AuthModule } from './core/auth/auth.module'
import { UserModule } from './core/user/user.module'
import { HealthModule } from './core/health/health.module'
import { SocialAccountModule } from './core/social-account/social-account.module'
import { MediaModule } from './core/media/media.module'
import { PublishModule } from './core/publish/publish.module'
import { DraftModule } from './core/draft/draft.module'
import { AutoReplyModule } from './core/auto-reply/auto-reply.module'
import { CommentModule } from './core/comment/comment.module'
import { AiModule } from './core/ai/ai.module'
import { WebhookModule } from './core/webhook/webhook.module'
import { AgentModule } from './core/agent/agent.module'
import { AgentWsModule } from './core/agent/ws/agent-ws.module'
import { BrandMonitorModule } from './core/brand-monitor/brand-monitor.module'
import { InsightModule } from './core/insight/insight.module'

@Module({
  imports: [
    ContextModule,           // CLS — phải import đầu tiên
    AppConfigModule,
    AppLoggerModule,
    DatabaseModule,
    QueueModule,             // BullMQ root config
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),

    StorageWireModule,       // @Global — S3/R2 client
    AiClientModule,          // @Global — AiClientService inject ở bất kỳ service nào
    AuthModule,
    UserModule,
    SocialAccountModule,
    MediaModule,
    PublishModule,
    DraftModule,
    CommentModule,
    AutoReplyModule,
    AiModule,
    WebhookModule,
    AgentModule,
    AgentWsModule,
    BrandMonitorModule,
    InsightModule,
    HealthModule,
  ],
})
export class AppModule {}
