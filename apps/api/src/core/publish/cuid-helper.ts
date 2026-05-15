import { randomBytes } from 'node:crypto'

/**
 * Lightweight cuid-ish — Prisma default cuid không expose helper, ta cần generate trước insert
 * cho createMany + bundle.
 */
export function cuid(): string {
  const ts = Date.now().toString(36)
  const random = randomBytes(8).toString('hex')
  return `c${ts}${random}`
}
