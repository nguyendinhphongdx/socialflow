/**
 * Ambient module shim cho `redlock@5` — package.json không expose types
 * trong `exports` map, nên tsc Bundler resolution không thấy dist/index.d.ts.
 * Khai báo lại type cần dùng (subset).
 */
declare module 'redlock' {
  import type { Redis, Cluster } from 'ioredis'
  type Client = Redis | Cluster

  export interface Settings {
    readonly driftFactor: number
    readonly retryCount: number
    readonly retryDelay: number
    readonly retryJitter: number
    readonly automaticExtensionThreshold: number
  }

  export class ResourceLockedError extends Error {
    constructor(message: string)
  }

  export class ExecutionError extends Error {
    readonly attempts: ReadonlyArray<Promise<unknown>>
    constructor(message: string, attempts: ReadonlyArray<Promise<unknown>>)
  }

  export class Lock {
    readonly resources: string[]
    readonly value: string
    expiration: number
    release(): Promise<unknown>
    extend(duration: number): Promise<Lock>
  }

  export default class Redlock {
    readonly clients: Set<Client>
    readonly settings: Settings
    constructor(
      clients: Iterable<Client>,
      settings?: Partial<Settings>,
    )
    on(event: 'error', listener: (err: Error) => void): this
    on(event: string, listener: (...args: unknown[]) => void): this
    quit(): Promise<void>
    acquire(
      resources: string[],
      duration: number,
      settings?: Partial<Settings>,
    ): Promise<Lock>
    release(lock: Lock, settings?: Partial<Settings>): Promise<unknown>
    extend(existing: Lock, duration: number, settings?: Partial<Settings>): Promise<Lock>
  }
}
