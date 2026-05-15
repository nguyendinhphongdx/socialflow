import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import IORedis, { type Redis } from 'ioredis'
import { APP_CONFIG, type AppConfig } from '../../../config'

/**
 * Snapshot 1 agent đang online lưu trong Redis.
 *
 * Key: `agent:online:{agentId}` — TTL extend mỗi heartbeat.
 * Index set: `agent:online:set` — sorted set theo score = lastSeen ts để list online cho dashboard.
 *
 * Concurrency: 1 agent có thể connect từ 2 browser — set lần sau ghi đè socketId,
 * gateway phía cũ tự disconnect khi nhận tín hiệu (ta không kill chủ động ở đây).
 */
export interface OnlineAgentEntry {
  agentId: string
  userId: string
  socketId: string
  capabilities: string[]
  lastSeenAt: number
}

const DEFAULT_TTL_SECONDS = 300
const KEY_PREFIX = 'agent:online'
const INDEX_KEY = 'agent:online:set'

@Injectable()
export class AgentRegistryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentRegistryService.name)
  private redis!: Redis

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  onModuleInit(): void {
    const url = new URL(this.config.redis.url)
    this.redis = new IORedis({
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    })
    this.redis.on('error', err => this.logger.error('Redis error', err.stack))
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
    }
  }

  private keyOf(agentId: string): string {
    return `${KEY_PREFIX}:${agentId}`
  }

  async markOnline(
    agentId: string,
    userId: string,
    socketId: string,
    capabilities: string[],
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const entry: OnlineAgentEntry = {
      agentId,
      userId,
      socketId,
      capabilities,
      lastSeenAt: Date.now(),
    }
    await this.redis
      .multi()
      .set(this.keyOf(agentId), JSON.stringify(entry), 'EX', ttlSeconds)
      .zadd(INDEX_KEY, entry.lastSeenAt, agentId)
      .exec()
  }

  async markOffline(agentId: string): Promise<void> {
    await this.redis
      .multi()
      .del(this.keyOf(agentId))
      .zrem(INDEX_KEY, agentId)
      .exec()
  }

  async getOnlineSocketId(agentId: string): Promise<string | null> {
    const entry = await this.getEntry(agentId)
    return entry?.socketId ?? null
  }

  async getEntry(agentId: string): Promise<OnlineAgentEntry | null> {
    const raw = await this.redis.get(this.keyOf(agentId))
    if (!raw) return null
    try {
      return JSON.parse(raw) as OnlineAgentEntry
    }
    catch {
      return null
    }
  }

  async isOnline(agentId: string): Promise<boolean> {
    return (await this.redis.exists(this.keyOf(agentId))) === 1
  }

  /**
   * Refresh TTL khi nhận heartbeat / pong. KHÔNG ghi đè entry hiện tại,
   * chỉ extend expire để chống false offline.
   */
  async extendTtl(agentId: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<boolean> {
    const expired = await this.redis.expire(this.keyOf(agentId), ttlSeconds)
    if (expired === 1) {
      await this.redis.zadd(INDEX_KEY, Date.now(), agentId)
      return true
    }
    return false
  }

  /**
   * Update lastSeenAt trong entry (khi pong/heartbeat đến) — giữ TTL mới.
   */
  async touchLastSeen(agentId: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    const entry = await this.getEntry(agentId)
    if (!entry) return
    entry.lastSeenAt = Date.now()
    await this.redis
      .multi()
      .set(this.keyOf(agentId), JSON.stringify(entry), 'EX', ttlSeconds)
      .zadd(INDEX_KEY, entry.lastSeenAt, agentId)
      .exec()
  }

  async listOnlineAgents(filter?: { userId?: string }): Promise<OnlineAgentEntry[]> {
    const agentIds = await this.redis.zrevrange(INDEX_KEY, 0, -1)
    if (agentIds.length === 0) return []
    const pipeline = this.redis.pipeline()
    for (const id of agentIds) pipeline.get(this.keyOf(id))
    const results = await pipeline.exec()
    if (!results) return []
    const entries: OnlineAgentEntry[] = []
    for (const [err, raw] of results) {
      if (err || !raw) continue
      try {
        const entry = JSON.parse(raw as string) as OnlineAgentEntry
        if (filter?.userId && entry.userId !== filter.userId) continue
        entries.push(entry)
      }
      catch {
        // ignore corrupt entry
      }
    }
    return entries
  }
}
