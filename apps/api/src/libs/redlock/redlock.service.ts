import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import type { Redis } from 'ioredis'
import Redlock, { ExecutionError, ResourceLockedError, type Lock } from 'redlock'
import { AppException, ResponseCode } from '@sociflow/common'

export const REDLOCK_REDIS_CLIENT = 'REDLOCK_REDIS_CLIENT'

export interface RedlockOptions {
  /** TTL của lock (ms). Mặc định 30s. */
  ttlMs?: number
  /** Số lần retry acquire. Mặc định 3. */
  retryCount?: number
  /** Delay giữa các lần retry (ms). Mặc định 200. */
  retryDelayMs?: number
}

/**
 * Distributed lock wrapper qua Redlock (Redis SET NX PX + Lua release).
 *
 * Use case Sociflow:
 * - `createBundle` cùng `idempotencyKey` từ 2 tab → 1 thắng, 1 đợi.
 * - Webhook idempotency lock (FB/IG event_id).
 * - Credit charge concurrent.
 *
 * Lock acquire fail (resource đang hold) → `AppException(ConcurrentRequest)`.
 * Lỗi business trong callback → throw nguyên trạng, finally vẫn release.
 */
@Injectable()
export class RedlockService implements OnModuleDestroy {
  private readonly logger = new Logger(RedlockService.name)
  private readonly redlock: Redlock

  constructor(@Inject(REDLOCK_REDIS_CLIENT) private readonly redis: Redis) {
    this.redlock = new Redlock([redis], {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 100,
      automaticExtensionThreshold: 500,
    })
    this.redlock.on('error', (err: Error) => {
      // Lock contention không nên log noise; chỉ infra error
      if (err instanceof ResourceLockedError) return
      this.logger.warn(`Redlock event error: ${err.message}`)
    })
  }

  async onModuleDestroy(): Promise<void> {
    // KHÔNG quit redlock vì có thể share Redis client với module khác.
    // Owner của Redis client tự quit ở module riêng.
  }

  /**
   * Acquire lock, chạy callback, auto-release. Lock TTL bảo vệ deadlock.
   *
   * @throws AppException(ConcurrentRequest) — lock không acquire được sau retry
   * @throws bất kỳ error nào fn throw — vẫn release trước khi rethrow
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options?: RedlockOptions,
  ): Promise<T> {
    const ttl = options?.ttlMs ?? 30_000
    const resource = this.resourceKey(key)
    const settings = this.overrideSettings(options)

    let lock: Lock
    try {
      lock = await this.redlock.acquire([resource], ttl, settings)
    } catch (err) {
      if (this.isLockContention(err)) {
        this.logger.debug(`Lock contention on ${resource}`)
        throw new AppException(ResponseCode.ConcurrentRequest, { resource: key })
      }
      throw err
    }

    try {
      return await fn()
    } finally {
      try {
        await lock.release()
      } catch (releaseErr) {
        // Lock có thể đã tự expire — log warn nhưng không throw
        this.logger.warn(
          `Lock release failed for ${resource}: ${releaseErr instanceof Error ? releaseErr.message : 'unknown'}`,
        )
      }
    }
  }

  /**
   * Try-lock không retry. Trả `null` nếu không acquire được (caller tự xử lý).
   */
  async tryLock<T>(
    key: string,
    fn: () => Promise<T>,
    options?: { ttlMs?: number },
  ): Promise<T | null> {
    const ttl = options?.ttlMs ?? 30_000
    const resource = this.resourceKey(key)
    let lock: Lock
    try {
      lock = await this.redlock.acquire([resource], ttl, { retryCount: 0 })
    } catch (err) {
      if (this.isLockContention(err)) return null
      throw err
    }
    try {
      return await fn()
    } finally {
      try {
        await lock.release()
      } catch {
        // ignore
      }
    }
  }

  private resourceKey(key: string): string {
    return `sociflow:lock:${key}`
  }

  private overrideSettings(options?: RedlockOptions): Partial<{
    retryCount: number
    retryDelay: number
  }> | undefined {
    if (!options) return undefined
    const out: { retryCount?: number, retryDelay?: number } = {}
    if (typeof options.retryCount === 'number') out.retryCount = options.retryCount
    if (typeof options.retryDelayMs === 'number') out.retryDelay = options.retryDelayMs
    return Object.keys(out).length > 0 ? out as never : undefined
  }

  private isLockContention(err: unknown): boolean {
    if (err instanceof ResourceLockedError) return true
    if (err instanceof ExecutionError) {
      const msg = (err as Error).message
      // Redlock 5 throw ExecutionError khi không đạt quorum
      return /unable to achieve a quorum/i.test(msg)
        || /resource is locked/i.test(msg)
    }
    return false
  }
}
