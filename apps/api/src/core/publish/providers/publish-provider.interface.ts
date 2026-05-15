import type { MediaAsset, PublishRecord, SocialAccount } from '@prisma/client'

/**
 * Result trả về từ provider sau khi publish thành công.
 */
export interface PublishResult {
  platformPostId: string
  workLink: string
}

export interface PublishContext {
  record: PublishRecord
  account: SocialAccount
  decryptedAccessToken: string
  mediaAssets: MediaAsset[]
}

/**
 * Mỗi platform (YouTube, FB, IG, TT) implement interface này.
 *
 * Throw `AppException(ResponseCode.PublishRejectedByPlatform)` khi platform reject
 * (content policy, copyright, ...) — không retry.
 * Throw `RetryableError` cho transient error (network, 5xx) — BullMQ retry.
 */
export interface PublishProvider {
  readonly platform: 'YOUTUBE' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK'
  publish(ctx: PublishContext): Promise<PublishResult>
}
