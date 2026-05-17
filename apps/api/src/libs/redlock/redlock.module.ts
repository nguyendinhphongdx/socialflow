import { Global, Logger, Module, type OnApplicationShutdown, type Provider } from '@nestjs/common'
import IORedis, { type Redis } from 'ioredis'
import { APP_CONFIG, type AppConfig } from '../../config'
import { REDLOCK_REDIS_CLIENT, RedlockService } from './redlock.service'

/**
 * Redis client riêng cho Redlock — KHÔNG share với BullMQ connection
 * (BullMQ pin `maxRetriesPerRequest: null`, Redlock cần retry behaviour mặc định).
 */
class RedlockRedisHolder implements OnApplicationShutdown {
  private readonly logger = new Logger('RedlockRedisHolder')
  constructor(public readonly client: Redis) {}
  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.quit()
    } catch (err) {
      this.logger.warn(`Redis quit failed: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }
}

const redisClientProvider: Provider = {
  provide: REDLOCK_REDIS_CLIENT,
  inject: [APP_CONFIG],
  useFactory: (config: AppConfig): Redis => {
    const url = new URL(config.redis.url)
    const client = new IORedis({
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    })
    const logger = new Logger('RedlockRedis')
    client.on('error', err => logger.error(`Redis error: ${err.message}`))
    return client
  },
}

@Global()
@Module({
  providers: [
    redisClientProvider,
    {
      provide: RedlockRedisHolder,
      inject: [REDLOCK_REDIS_CLIENT],
      useFactory: (client: Redis) => new RedlockRedisHolder(client),
    },
    RedlockService,
  ],
  exports: [RedlockService],
})
export class RedlockModule {}
