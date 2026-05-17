import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { AppException, ResponseCode, RetryableError } from '@sociflow/common'
import type { PublishContext, PublishProvider, PublishResult } from './publish-provider.interface'

const GRAPH = 'https://graph.facebook.com/v21.0'
const MAX_CONTAINER_POLL_ATTEMPTS = 30
const CONTAINER_POLL_INTERVAL_MS = 2000

/**
 * Instagram Graph publish — 2-step container flow:
 *
 * 1. POST /{ig-user-id}/media — tạo container với `image_url` hoặc `video_url`,
 *    nhận `creation_id`.
 * 2. Poll container `status_code` cho đến `FINISHED` (video transcoding mất time).
 * 3. POST /{ig-user-id}/media_publish — publish container, nhận `media_id`.
 *
 * IG Reel: cùng API nhưng `media_type=REELS`.
 * IG Feed image: không `media_type` param.
 */
@Injectable()
export class InstagramProvider implements PublishProvider {
  readonly platform = 'INSTAGRAM' as const
  private readonly logger = new Logger(InstagramProvider.name)

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const igId = ctx.account.platformUid
    const accessToken = ctx.decryptedAccessToken
    const caption = [ctx.record.title, ctx.record.body].filter(Boolean).join('\n\n')

    const platformOptions = (ctx.record.platformOptions ?? {}) as Record<string, unknown>
    const isReel = platformOptions.mediaType === 'REELS'

    const video = ctx.mediaAssets.find(m => m.type === 'VIDEO')
    const image = ctx.mediaAssets.find(m => m.type === 'IMAGE')

    if (!video && !image) {
      throw new AppException(ResponseCode.PublishTaskInvalid, { reason: 'ig_requires_media' })
    }

    const containerId = video
      ? await this.createVideoContainer(igId, accessToken, video.publicUrl, caption, isReel)
      : await this.createImageContainer(igId, accessToken, image!.publicUrl, caption)

    await this.waitForContainerReady(containerId, accessToken)
    const mediaId = await this.publishContainer(igId, accessToken, containerId)

    this.logger.log(`IG publish success ${igId} → ${mediaId}`)
    return {
      platformPostId: mediaId,
      workLink: `https://instagram.com/p/${mediaId}`,
    }
  }

  private async createImageContainer(igId: string, accessToken: string, imageUrl: string, caption: string): Promise<string> {
    return this.postContainer(`${GRAPH}/${igId}/media`, accessToken, {
      image_url: imageUrl,
      caption,
    })
  }

  private async createVideoContainer(igId: string, accessToken: string, videoUrl: string, caption: string, isReel: boolean): Promise<string> {
    return this.postContainer(`${GRAPH}/${igId}/media`, accessToken, {
      video_url: videoUrl,
      caption,
      ...(isReel && { media_type: 'REELS' }),
    })
  }

  private async postContainer(url: string, accessToken: string, fields: Record<string, string>): Promise<string> {
    try {
      const response = await axios.post<{ id?: string }>(
        url,
        new URLSearchParams({ ...fields, access_token: accessToken }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      )
      if (!response.data.id) {
        throw new AppException(ResponseCode.PublishFailed, { provider: 'instagram', stage: 'container', details: response.data })
      }
      return response.data.id
    }
    catch (err) {
      this.mapGraphError(err, 'container')
      throw err
    }
  }

  private async waitForContainerReady(containerId: string, accessToken: string): Promise<void> {
    for (const _ of Array.from({ length: MAX_CONTAINER_POLL_ATTEMPTS })) {
      const status = await this.getContainerStatus(containerId, accessToken)
      if (status === 'FINISHED') return
      if (status === 'ERROR' || status === 'EXPIRED') {
        throw new AppException(ResponseCode.PublishFailed, {
          provider: 'instagram',
          stage: 'container_processing',
          status,
        })
      }
      await new Promise(r => setTimeout(r, CONTAINER_POLL_INTERVAL_MS))
    }
    throw new RetryableError(`IG container ${containerId} not ready after ${MAX_CONTAINER_POLL_ATTEMPTS} polls`)
  }

  private async getContainerStatus(containerId: string, accessToken: string): Promise<string> {
    const response = await axios.get<{ status_code?: string }>(
      `${GRAPH}/${containerId}`,
      { params: { fields: 'status_code', access_token: accessToken } },
    ).catch((err) => {
      this.mapGraphError(err, 'container_status')
      throw err
    })
    return response.data.status_code ?? 'IN_PROGRESS'
  }

  private async publishContainer(igId: string, accessToken: string, containerId: string): Promise<string> {
    try {
      const response = await axios.post<{ id?: string }>(
        `${GRAPH}/${igId}/media_publish`,
        new URLSearchParams({ creation_id: containerId, access_token: accessToken }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      )
      if (!response.data.id) {
        throw new AppException(ResponseCode.PublishFailed, { provider: 'instagram', stage: 'publish', details: response.data })
      }
      return response.data.id
    }
    catch (err) {
      this.mapGraphError(err, 'publish')
      throw err
    }
  }

  private mapGraphError(err: unknown, stage: string): never {
    const status = (err as { response?: { status?: number } }).response?.status
    const data = (err as { response?: { data?: { error?: { code?: number, type?: string, message?: string } } } }).response?.data
    const fbError = data?.error

    if (fbError?.code === 190 || status === 401) {
      throw new AppException(ResponseCode.AccountTokenExpired, { provider: 'instagram', fbError })
    }
    if (fbError?.code === 506 || fbError?.type === 'OAuthException') {
      throw new AppException(ResponseCode.PublishRejectedByPlatform, { provider: 'instagram', fbError })
    }
    if (status && status >= 500) {
      throw new RetryableError(`IG ${stage} ${status}: ${fbError?.message}`)
    }
    if (err instanceof AppException) throw err
    throw new AppException(ResponseCode.PublishFailed, { provider: 'instagram', stage, fbError, details: data })
  }
}
