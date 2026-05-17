/// <reference types="chrome" />

/**
 * DOM polling helpers cho content script.
 *
 * Tránh MutationObserver phức tạp ở stub level — polling đơn giản đủ
 * cho most cases. Real implementation có thể optimize sau bằng observer
 * nếu poll frequency cao.
 */

import { sleep } from './random-delay'

export interface WaitOptions {
  timeoutMs?: number
  intervalMs?: number
}

const DEFAULT_TIMEOUT = 30_000
const DEFAULT_INTERVAL = 250

export async function waitForSelector<T extends Element = Element>(
  selector: string,
  options: WaitOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector<T>(selector)
    if (el) return el
    await sleep(intervalMs)
  }
  throw new Error(`Timeout waiting for selector: ${selector}`)
}

export async function waitForUrl(
  pattern: RegExp,
  options: WaitOptions = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (pattern.test(location.href)) return location.href
    await sleep(intervalMs)
  }
  throw new Error(`Timeout waiting for url pattern: ${pattern}`)
}

/**
 * Convenience query — typed null if missing (don't throw).
 */
export function query<T extends Element = Element>(selector: string): T | null {
  return document.querySelector<T>(selector)
}
