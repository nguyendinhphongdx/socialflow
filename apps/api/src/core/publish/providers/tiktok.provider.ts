import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { AppException, ResponseCode, RetryableError } from '@sociflow/common'
import type { PublishContext, PublishProvider, PublishResult } from './publish-provider.interface'

const TT = 'https://open.tiktokapis.com/v2'
const MAX_POLL_ATTEMPTS = 30
const POLL_INTERVAL_MS = 3000

/**
 * TikTok Content Posting API v2 — Direct Post flow.
 *
 * Steps:
 * 1. POST /post/publish/video/init/ — init upload session
 *    - source = PULL_FROM_URL → TikTok pull video từ public URL
 *    - returns `publish_id` để track
 * 2. Poll GET /post/publish/status/fetch/ với publish_id
 *    - status: PROCESSING_UPLOAD → PROCESSING_DOWNLOAD → SEND_TO_USER_INBOX | PUBLISH_COMPLETE
 *
 * Alternative: source = FILE_UPLOAD (cần chunk upload) — phức tạp hơn, phase sau.
 *
 * **Lưu ý**: Phase 0 dùng `PULL_FROM_URL` đơn giản, video phải public URL accessible từ TikTok.
 */
@Injectable()
export class TikTokProvider implements PublishProvider {
  readonly platform = 'TIKTOK' as const
  private readonly logger = new Logger(TikTokProvider.name)

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const video = ctx.mediaAssets.find(m => m.type === 'VIDEO')
    if (!video) {
      throw new AppException(ResponseCode.PublishTaskInvalid, { reason: 'tiktok_requires_video' })
    }

    const accessToken = ctx.decryptedAccessToken
    const platformOptions = (ctx.record.platformOptions ?? {}) as Record<string, unknown>

    const title = ctx.record.title?.slice(0, 150) ?? ''
    const description = ctx.record.body?.slice(0, 2200) ?? ''
    const caption = description || title
    const privacy = typeof platformOptions.privacy === 'string'
      ? platformOptions.privacy
      : 'SELF_ONLY'                                        // SELF_ONLY | MUTUAL_FOLLOW_FRIENDS | PUBLIC_TO_EVERYONE

    const publishId = await this.initPublish(accessToken, video.publicUrl, caption, privacy, platformOptions)
    const result = await this.waitForPublishComplete(accessToken, publishId)

    this.logger.log(`TikTok publish success record=${ctx.record.id} publishId=${publishId} videoId=${result.platformPostId}`)
    return result
  }

  private async initPublish(
    accessToken: string,
    videoUrl: string,
    caption: string,
    privacyLevel: string,
    platformOptions: Record<string, unknown>,
  ): Promise<string> {
    const body = {
      post_info: {
        title: caption,
        privacy_level: privacyLevel,
        disable_duet: platformOptions.disableDuet === true,
        disable_comment: platformOptions.disableComment === true,
        disable_stitch: platformOptions.disableStitch === true,
        video_cover_timestamp_ms: typeof platformOptions.coverTimestampMs === 'number'
          ? platformOptions.coverTimestampMs
          : 1000,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    }

    try {
      const response = await axios.post<{ data?: { publish_id?: string }, error?: { code?: string, message?: string } }>(
        `${TT}/post/publish/video/init/`,
        body,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
        },
      )
      if (!response.data.data?.publish_id) {
        throw new AppException(ResponseCode.PublishFailed, {
          provider: 'tiktok',
          stage: 'init',
          error: response.data.error,
        })
      }
      return response.data.data.publish_id
    }
    catch (err) {
      this.mapError(err, 'init')
      throw err
    }
  }

  private async waitForPublishComplete(accessToken: string, publishId: string): Promise<PublishResult> {
    for (const _ of Array.from({ length: MAX_POLL_ATTEMPTS })) {
      const status = await this.fetchStatus(accessToken, publishId)
      const code = status.status
      if (code === 'PUBLISH_COMPLETE' || code === 'SEND_TO_USER_INBOX') {
        return {
          platformPostId: status.publicaly_available_post_id ?? publishId,
          workLink: status.publicaly_available_post_id
            ? `https://www.tiktok.com/@user/video/${status.publicaly_available_post_id}`
            : `https://www.tiktok.com/`,
        }
      }
      if (code === 'FAILED') {
        if (status.failReason?.includes('content')) {
          throw new AppException(ResponseCode.PublishRejectedByPlatform, { provider: 'tiktok', reason: status.failReason })
        }
        throw new AppException(ResponseCode.PublishFailed, { provider: 'tiktok', failReason: status.failReason })
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    }
    throw new RetryableError(`TikTok publish ${publishId} not complete after ${MAX_POLL_ATTEMPTS} polls`)
  }

  private async fetchStatus(accessToken: string, publishId: string): Promise<{
    status: string
    publicaly_available_post_id?: string
    failReason?: string
  }> {
    interface StatusResponse {
      data?: {
        status?: string
        publicaly_available_post_id?: string
        fail_reason?: string
      }
      error?: { code?: string, message?: string }
    }
    const response = await axios.post<StatusResponse>(
      `${TT}/post/publish/status/fetch/`,
      { publish_id: publishId },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      },
    ).catch((err) => {
      this.mapError(err, 'status')
      throw err
    })

    const data = response.data.data
    return {
      status: data?.status ?? 'UNKNOWN',
      publicaly_available_post_id: data?.publicaly_available_post_id,
      failReason: data?.fail_reason,
    }
  }

  private mapError(err: unknown, stage: string): never {
    const status = (err as { response?: { status?: number } }).response?.status
    const data = (err as { response?: { data?: { error?: { code?: string, message?: string } } } }).response?.data
    const ttError = data?.error

    if (status === 401 || ttError?.code === 'access_token_invalid') {
      throw new AppException(ResponseCode.AccountTokenExpired, { provider: 'tiktok', ttError })
    }
    if (ttError?.code === 'unaudited_client_can_only_post_to_private_accounts') {
      throw new AppException(ResponseCode.PublishRejectedByPlatform, { provider: 'tiktok', reason: 'unaudited_app', ttError })
    }
    if (status && status >= 500) {
      throw new RetryableError(`TikTok ${stage} ${status}: ${ttError?.message}`)
    }
    if (err instanceof AppException) throw err
    throw new AppException(ResponseCode.PublishFailed, { provider: 'tiktok', stage, ttError, details: data })
  }
}
