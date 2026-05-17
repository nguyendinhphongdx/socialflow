/**
 * Next.js instrumentation hook — chạy 1 lần khi server start.
 *
 * Sentry SDK detect runtime (nodejs / edge) qua `NEXT_RUNTIME` env var
 * và import config tương ứng. Cấu hình thật ở `sentry.{server,edge}.config.ts`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}
