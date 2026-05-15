import { ResponseCode } from './response-code'

/**
 * Business exception. KHÔNG throw `new Error()` cho business code.
 *
 * HTTP status luôn 200 — filter map ra envelope `{ data, code, message, timestamp }`.
 * Infrastructure error (DB down, OOM) thì để framework filter 5xx.
 */
export class AppException extends Error {
  readonly code: ResponseCode
  readonly data?: unknown

  constructor(code: ResponseCode, data?: unknown) {
    super(`AppException[${code}]`)
    this.name = 'AppException'
    this.code = code
    this.data = data
  }
}

/**
 * Retryable infrastructure error — BullMQ sẽ retry với backoff.
 * Dùng cho: token refresh, transient network, rate limit hồi phục.
 */
export class RetryableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'RetryableError'
  }
}
