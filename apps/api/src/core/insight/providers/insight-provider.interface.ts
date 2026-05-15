import type { AccountPlatform, SocialAccount } from '@prisma/client'

/**
 * Raw metrics trả về từ platform — đã normalize tên field về common.
 * Field bất kỳ platform-specific gói trong `raw`.
 */
export interface RawMetrics {
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  reachUnique: number
  raw: Record<string, unknown>
}

/**
 * Mỗi platform implement interface này để fetch insight.
 *
 * Throw `RetryableError` cho transient (network, rate limit có Retry-After) → BullMQ retry.
 * Throw `AppException(InsightFetchFailed, { reason })` cho lỗi không retry (stub, auth, scope thiếu).
 * Throw `AppException(AccountTokenExpired)` để upstream mark account token expired.
 */
export interface InsightProvider {
  readonly platform: AccountPlatform

  fetchPostMetrics(account: SocialAccount, decryptedToken: string, platformPostId: string): Promise<RawMetrics>

  fetchAccountFollowers(account: SocialAccount, decryptedToken: string): Promise<number>
}
