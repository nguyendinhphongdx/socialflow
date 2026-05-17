import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

interface SentryInitOptions {
  dsn?: string
  environment: string
  release?: string
  tracesSampleRate: number
  profilesSampleRate: number
  serverName: string
}

/**
 * Init Sentry SDK cho NestJS process. Phải gọi TRƯỚC khi NestFactory.create().
 *
 * Skip nếu `dsn` rỗng — dev/local environment.
 *
 * `beforeSend` lọc business 4xx — chỉ capture 5xx / unexpected error.
 */
export function initSentry(opts: SentryInitOptions): boolean {
  if (!opts.dsn) {
    return false
  }

  Sentry.init({
    dsn: opts.dsn,
    environment: opts.environment,
    release: opts.release,
    serverName: opts.serverName,
    tracesSampleRate: opts.tracesSampleRate,
    profilesSampleRate: opts.profilesSampleRate,
    integrations: [
      nodeProfilingIntegration(),
    ],
    beforeSend(event, hint) {
      const err = hint?.originalException as { code?: number, status?: number } | undefined
      if (typeof err?.status === 'number' && err.status < 500 && err.status >= 400) {
        return null
      }
      if (typeof err?.code === 'number' && err.code >= 10000) {
        return null
      }
      return event
    },
  })

  return true
}

export { Sentry }
