import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { AppException, ResponseCode, RetryableError } from '@sociflow/common'
import type { PublishContext, PublishProvider, PublishResult } from './publish-provider.interface'

const GRAPH = 'https://graph.facebook.com/v21.0'

/**
 * Facebook page provider — post text / photo / video.
 *
 * Mode:
 * - Text-only → POST /{pageId}/feed { message }
 * - Single photo → POST /{pageId}/photos { url, caption } (cần media public URL)
 * - Single video → POST /{pageId}/videos { file_url, description }
 *
 * Multi-photo album, link preview, story đẩy sang Phase 3.
 */
@Injectable()
export class FacebookProvider implements PublishProvider {
  readonly platform = 'FACEBOOK' as const
  private readonly logger = new Logger(FacebookProvider.name)

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const message = [ctx.record.title, ctx.record.body].filter(Boolean).join('\n\n')
    const pageId = ctx.account.platformUid
    const accessToken = ctx.decryptedAccessToken

    const video = ctx.mediaAssets.find(m => m.type === 'VIDEO')
    const photos = ctx.mediaAssets.filter(m => m.type === 'IMAGE')

    if (video) {
      return this.postVideo(pageId, accessToken, message, video.publicUrl)
    }
    if (photos.length === 1) {
      return this.postSinglePhoto(pageId, accessToken, message, photos[0]!.publicUrl)
    }
    if (photos.length > 1) {
      throw new AppException(ResponseCode.PublishTaskInvalid, {
        reason: 'fb_multi_photo_not_implemented_yet',
      })
    }
    return this.postText(pageId, accessToken, message)
  }

  private async postText(pageId: string, accessToken: string, message: string): Promise<PublishResult> {
    if (!message) {
      throw new AppException(ResponseCode.PublishTaskInvalid, { reason: 'fb_text_post_requires_message' })
    }
    return this.callGraph(`/${pageId}/feed`, accessToken, { message })
  }

  private async postSinglePhoto(pageId: string, accessToken: string, caption: string, photoUrl: string): Promise<PublishResult> {
    return this.callGraph(`/${pageId}/photos`, accessToken, { url: photoUrl, caption })
  }

  private async postVideo(pageId: string, accessToken: string, description: string, videoUrl: string): Promise<PublishResult> {
    return this.callGraph(`/${pageId}/videos`, accessToken, { file_url: videoUrl, description })
  }

  private async callGraph(path: string, accessToken: string, body: Record<string, string>): Promise<PublishResult> {
    try {
      const response = await axios.post<{ id?: string, post_id?: string }>(
        `${GRAPH}${path}`,
        new URLSearchParams({ ...body, access_token: accessToken }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      )
      const id = response.data.post_id ?? response.data.id
      if (!id) {
        throw new AppException(ResponseCode.PublishFailed, { provider: 'facebook', details: response.data })
      }
      this.logger.log(`FB publish success ${path} → ${id}`)
      return {
        platformPostId: id,
        workLink: `https://facebook.com/${id}`,
      }
    }
    catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status
      const data = (err as { response?: { data?: { error?: { code?: number, type?: string, message?: string } } } }).response?.data
      const fbError = data?.error

      if (fbError?.code === 190 || status === 401) {
        // OAuth token expired/invalid
        throw new AppException(ResponseCode.AccountTokenExpired, { provider: 'facebook', fbError })
      }
      if (fbError?.code === 506 || fbError?.type === 'OAuthException') {
        throw new AppException(ResponseCode.PublishRejectedByPlatform, { provider: 'facebook', fbError })
      }
      if (status && status >= 500) {
        throw new RetryableError(`FB graph ${status}: ${fbError?.message}`)
      }
      if (err instanceof AppException) throw err
      throw new AppException(ResponseCode.PublishFailed, { provider: 'facebook', fbError, details: data })
    }
  }
}
