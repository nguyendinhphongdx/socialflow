import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { SentryInterceptor } from './common/sentry/sentry.interceptor'
import { ScheduleModule } from '@nestjs/schedule'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { ContextModule } from '@sociflow/auth'
import { AppConfigModule } from './config'
import { DatabaseModule } from './libs/database/database.module'
import { AppLoggerModule } from './libs/logger/logger.module'
import { AiClientModule } from './libs/ai-client/ai-client.module'
import { QueueModule } from './libs/queue/queue.module'
import { RedlockModule } from './libs/redlock/redlock.module'
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
import { CreditsModule } from './core/credits/credits.module'
import { NotificationModule } from './core/notification/notification.module'
import { ApiKeyModule } from './core/api-key/api-key.module'
import { WorkspaceModule } from './core/workspace/workspace.module'

@Module({
  imports: [
    ContextModule,           // CLS — phải import đầu tiên
    AppConfigModule,
    AppLoggerModule,
    DatabaseModule,
    QueueModule,             // BullMQ root config
    RedlockModule,           // @Global — distributed lock service
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    // Rate limit toàn cục — 100 req/60s/IP cho endpoint chưa override @Throttle.
    // Endpoint sensitive (login, register, refresh, agent claim) tự khai báo @Throttle
    // chặt hơn ở controller. Endpoint authed có thể nới rộng — tham khảo
    // .claude/rules/security.md "Rate limiting".
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
    }),

    StorageWireModule,       // @Global — S3/R2 client
    AiClientModule,          // @Global — AiClientService inject ở bất kỳ service nào
    UserModule,
    WorkspaceModule,         // F-716 — multi-tenant. Must register BEFORE AuthModule
                             // vì AuthService inject WorkspaceService cho register/login flow.
    AuthModule,
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
    CreditsModule,
    NotificationModule,
    ApiKeyModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Sentry interceptor — chạy trước AppExceptionFilter, capture unexpected error.
    // Skip nếu SENTRY_DSN rỗng (Sentry.captureException no-op khi chưa init).
    { provide: APP_INTERCEPTOR, useClass: SentryInterceptor },
  ],
})
export class AppModule {}
