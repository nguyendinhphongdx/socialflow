/// <reference types="chrome" />

/**
 * Anti-detection delay utilities.
 *
 * Mục đích: tránh pattern timing đều (signature bot rõ ràng). Mọi action
 * trong content script phải xen kẽ `pauseBetweenActions()` để mô phỏng
 * human reaction time.
 *
 * NOTE: KHÔNG dùng `Date.now()` cho business logic test-friendly,
 * nhưng ở đây jitter cần Math.random() — đây là policy intentional
 * exception (anti-detection > test purity).
 */

const DEFAULT_MIN_MS = 300
const DEFAULT_MAX_MS = 1500
const TYPING_MIN_MS = 50
const TYPING_MAX_MS = 180

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function randomBetween(minMs: number, maxMs: number): number {
  if (maxMs < minMs) return minMs
  const span = maxMs - minMs
  return Math.floor(minMs + Math.random() * span)
}

/**
 * Pause giữa 2 action user-driven (click → fill → click).
 * Default jitter 300-1500ms phù hợp human reaction nhưng không quá chậm.
 */
export async function pauseBetweenActions(
  minMs = DEFAULT_MIN_MS,
  maxMs = DEFAULT_MAX_MS,
): Promise<void> {
  await sleep(randomBetween(minMs, maxMs))
}

/**
 * Delay giữa 2 keystroke khi typing — chậm hơn paste detect.
 */
export async function keystrokeDelay(): Promise<void> {
  await sleep(randomBetween(TYPING_MIN_MS, TYPING_MAX_MS))
}

/**
 * Gaussian-like jitter cho dispersion thực hơn (occasional outlier).
 * Box-Muller transform → clamp về [minMs, maxMs].
 */
export function gaussianBetween(minMs: number, maxMs: number): number {
  const mean = (minMs + maxMs) / 2
  const stddev = (maxMs - minMs) / 4
  const u1 = Math.random() || 1e-9
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  const value = Math.floor(mean + z * stddev)
  return Math.max(minMs, Math.min(maxMs, value))
}
