import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { AppException, ResponseCode, RetryableError } from '@sociflow/common'
import type { PublishContext, PublishProvider, PublishResult } from './publish-provider.interface'

const RESUMABLE_INIT_URL = 'https://www.googleapis.com/upload/youtube/v3/videos'
const VIDEO_LIST_URL = 'https://www.googleapis.com/youtube/v3/videos'

/**
 * YouTubeProvider — upload video resumable theo YT Data API v3.
 *
 * Flow:
 * 1. POST init session → trả `Location` (resumable URL)
 * 2. PUT video bytes lên Location
 * 3. Response trả `id` = video ID
 *
 * Phase 0 implementation: stream từ public CDN URL (MediaAsset.publicUrl).
 * Phase later: stream từ S3 signed URL (chống public exposure).
 */
@Injectable()
export class YouTubeProvider implements PublishProvider {
  readonly platform = 'YOUTUBE' as const
  private readonly logger = new Logger(YouTubeProvider.name)

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const video = ctx.mediaAssets.find(m => m.type === 'VIDEO')
    if (!video) {
      throw new AppException(ResponseCode.PublishTaskInvalid, { reason: 'youtube_requires_video' })
    }

    const platformOptions = (ctx.record.platformOptions ?? {}) as Record<string, unknown>
    const privacy = typeof platformOptions.privacy === 'string'
      ? platformOptions.privacy
      : 'private'
    const category = typeof platformOptions.categoryId === 'string'
      ? platformOptions.categoryId
      : '22'    // People & Blogs

    const metadata = {
      snippet: {
        title: ctx.record.title ?? video.filename,
        description: ctx.record.body ?? '',
        categoryId: category,
        tags: Array.isArray(platformOptions.tags) ? platformOptions.tags : [],
      },
      status: {
        privacyStatus: privacy,
        selfDeclaredMadeForKids: false,
      },
    }

    const uploadLocation = await this.initResumable(ctx.decryptedAccessToken, metadata, video.mimeType, video.sizeBytes)
    const videoUrl = await this.streamFromPublicUrl(video.publicUrl)
    const videoId = await this.uploadVideo(uploadLocation, videoUrl, video.mimeType, video.sizeBytes, ctx.decryptedAccessToken)

    this.logger.log(`YouTube publish success videoId=${videoId} record=${ctx.record.id}`)
    return {
      platformPostId: videoId,
      workLink: `https://www.youtube.com/watch?v=${videoId}`,
    }
  }

  private async initResumable(accessToken: string, metadata: unknown, mimeType: string, sizeBytes: number): Promise<string> {
    try {
      const response = await axios.post(
        `${RESUMABLE_INIT_URL}?uploadType=resumable&part=snippet,status`,
        metadata,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': mimeType,
            'X-Upload-Content-Length': String(sizeBytes),
          },
          maxBodyLength: Infinity,
        },
      )
      const location = response.headers.location ?? response.headers.Location
      if (!location) {
        throw new RetryableError('YT init resumable: no Location header')
      }
      return String(location)
    }
    catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status
      if (status === 401 || status === 403) {
        throw new AppException(ResponseCode.AccountTokenExpired, { provider: 'youtube' })
      }
      if (status && status >= 500) throw new RetryableError(`YT init failed ${status}`)
      const data = (err as { response?: { data?: unknown } }).response?.data
      throw new AppException(ResponseCode.PublishFailed, { provider: 'youtube', stage: 'init', details: data })
    }
  }

  /**
   * Stream video từ public URL (MinIO/R2 public bucket) — return ArrayBuffer.
   * Phase 1 đơn giản; large file >100MB nên đổi sang streaming PUT thật.
   */
  private async streamFromPublicUrl(url: string): Promise<Buffer> {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }).catch(() => {
      throw new RetryableError(`fetch media failed: ${url}`)
    })
    return Buffer.from(response.data)
  }

  private async uploadVideo(uploadUrl: string, body: Buffer, mimeType: string, sizeBytes: number, accessToken: string): Promise<string> {
    try {
      const response = await axios.put<{ id?: string, error?: unknown }>(
        uploadUrl,
        body,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': mimeType,
            'Content-Length': String(sizeBytes),
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        },
      )
      if (!response.data.id) {
        throw new AppException(ResponseCode.PublishFailed, { provider: 'youtube', stage: 'upload', details: response.data })
      }
      return response.data.id
    }
    catch (err) {
      if (err instanceof AppException) throw err
      const status = (err as { response?: { status?: number } }).response?.status
      const data = (err as { response?: { data?: unknown } }).response?.data
      if (status && status >= 500) throw new RetryableError(`YT upload failed ${status}`)
      if (status === 400 && JSON.stringify(data).toLowerCase().includes('rejected')) {
        throw new AppException(ResponseCode.PublishRejectedByPlatform, { provider: 'youtube', details: data })
      }
      throw new AppException(ResponseCode.PublishFailed, { provider: 'youtube', stage: 'upload', details: data })
    }
  }
}
