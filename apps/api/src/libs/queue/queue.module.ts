import { Global, Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { APP_CONFIG, type AppConfig } from '../../config'

export const QUEUE_NAMES = {
  TOKEN_REFRESH: 'token-refresh',
  PUBLISH_IMMEDIATE: 'publish-immediate',
  PUBLISH_SCHEDULED: 'publish-scheduled',
  AGENT_DISPATCH: 'agent-dispatch',
  AUTO_REPLY: 'auto-reply',
  INSIGHT_SNAPSHOT: 'insight-snapshot',
  COMMENT_SYNC: 'comment-sync',
  CREDITS_PURCHASE: 'credits-purchase',
  CREDITS_REFUND: 'credits-refund',
  NOTIFICATION: 'notification',
  BRAND_SENTIMENT: 'brand-sentiment',
} as const

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        const url = new URL(config.redis.url)
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { age: 24 * 3600, count: 1000 },
            removeOnFail: { age: 7 * 24 * 3600 },
          },
        }
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.TOKEN_REFRESH },
      { name: QUEUE_NAMES.PUBLISH_IMMEDIATE },
      { name: QUEUE_NAMES.AUTO_REPLY },
      { name: QUEUE_NAMES.INSIGHT_SNAPSHOT },
      { name: QUEUE_NAMES.COMMENT_SYNC },
      { name: QUEUE_NAMES.CREDITS_PURCHASE },
      { name: QUEUE_NAMES.CREDITS_REFUND },
      { name: QUEUE_NAMES.NOTIFICATION },
      { name: QUEUE_NAMES.BRAND_SENTIMENT },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
