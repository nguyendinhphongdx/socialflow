import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResourceLockedError } from 'redlock'
import { ResponseCode } from '@sociflow/common'
import { RedlockService } from './redlock.service'

interface FakeLock {
  release: ReturnType<typeof vi.fn>
}

function makeRedlockMock() {
  const release = vi.fn().mockResolvedValue(undefined)
  const lock: FakeLock = { release }
  const acquire = vi.fn().mockResolvedValue(lock)
  return { acquire, release, lock }
}

describe('RedlockService', () => {
  let service: RedlockService
  let acquireMock: ReturnType<typeof vi.fn>
  let releaseMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // RedlockService constructor instantiate `new Redlock([redis], settings)`.
    // Stub Redis client với eval/evalsha noop. Sau đó override redlock instance.
    const fakeRedis = {
      eval: vi.fn(),
      evalsha: vi.fn(),
      on: vi.fn(),
      script: vi.fn(),
    }
    service = new RedlockService(fakeRedis as never)

    const m = makeRedlockMock()
    acquireMock = m.acquire
    releaseMock = m.release
    // Inject mock vào private property
    Object.defineProperty(service, 'redlock', {
      value: { acquire: acquireMock, on: vi.fn() },
      configurable: true,
    })
  })

  describe('withLock', () => {
    it('acquires lock, runs callback, releases lock', async () => {
      const fn = vi.fn().mockResolvedValue('result')
      const result = await service.withLock('test-key', fn)

      expect(result).toBe('result')
      expect(acquireMock).toHaveBeenCalledWith(['sociflow:lock:test-key'], 30_000, undefined)
      expect(fn).toHaveBeenCalledTimes(1)
      expect(releaseMock).toHaveBeenCalledTimes(1)
    })

    it('uses custom ttl when provided', async () => {
      await service.withLock('k', () => Promise.resolve(), { ttlMs: 5000 })
      expect(acquireMock).toHaveBeenCalledWith(['sociflow:lock:k'], 5000, undefined)
    })

    it('passes retryCount and retryDelay to redlock settings', async () => {
      await service.withLock('k', () => Promise.resolve(), {
        retryCount: 5,
        retryDelayMs: 100,
      })
      expect(acquireMock).toHaveBeenCalledWith(
        ['sociflow:lock:k'],
        30_000,
        expect.objectContaining({ retryCount: 5, retryDelay: 100 }),
      )
    })

    it('releases lock even when callback throws', async () => {
      const err = new Error('business error')
      const fn = vi.fn().mockRejectedValue(err)

      await expect(service.withLock('k', fn)).rejects.toThrow(err)
      expect(releaseMock).toHaveBeenCalledTimes(1)
    })

    it('throws ConcurrentRequest when ResourceLockedError on acquire', async () => {
      acquireMock.mockRejectedValueOnce(new ResourceLockedError('locked'))
      await expect(service.withLock('k', () => Promise.resolve('x')))
        .rejects.toMatchObject({ code: ResponseCode.ConcurrentRequest })
    })

    it('throws ConcurrentRequest when ExecutionError quorum message', async () => {
      class ExecErr extends Error {
        attempts: unknown[] = []
        constructor(msg: string) { super(msg); this.name = 'ExecutionError' }
      }
      // Match by message — service uses regex on ExecutionError instance
      // (we simulate by extending Error since the instanceof check is library-specific)
      const err = new ExecErr('The operation was unable to achieve a quorum during its retry window.')
      Object.setPrototypeOf(err, (await import('redlock')).ExecutionError.prototype)
      acquireMock.mockRejectedValueOnce(err)
      await expect(service.withLock('k', () => Promise.resolve()))
        .rejects.toMatchObject({ code: ResponseCode.ConcurrentRequest })
    })

    it('does not swallow release errors but still returns result', async () => {
      releaseMock.mockRejectedValueOnce(new Error('release failed'))
      const result = await service.withLock('k', () => Promise.resolve('ok'))
      expect(result).toBe('ok')
    })
  })

  describe('tryLock', () => {
    it('returns callback result when lock acquired', async () => {
      const result = await service.tryLock('k', () => Promise.resolve(42))
      expect(result).toBe(42)
      expect(releaseMock).toHaveBeenCalledTimes(1)
    })

    it('returns null when lock contended', async () => {
      acquireMock.mockRejectedValueOnce(new ResourceLockedError('busy'))
      const fn = vi.fn()
      const result = await service.tryLock('k', fn)
      expect(result).toBeNull()
      expect(fn).not.toHaveBeenCalled()
    })
  })
})
