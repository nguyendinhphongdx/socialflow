import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { AppException, ResponseCode, RetryableError } from '@sociflow/common'
import type { SocialAccount } from '@prisma/client'
import type { InsightProvider, RawMetrics } from './insight-provider.interface'

const TT = 'https://open.tiktokapis.com/v2'

const POST_METRIC_FIELDS = ['view_count', 'like_count', 'comment_count', 'share_count']

/**
 * TikTokInsightProvider — fetch metric video qua TikTok Research API + Display API.
 *
 * Endpoint:
 * - POST /research/video/query/ — chi tiết engagement (cần Research API scope, App Review)
 * - GET  /user/info/?fields=follower_count — follower count (Display API, basic scope)
 *
 * Research API scope KHÔNG tự động cấp — user account nào không có scope sẽ
 * fallback gracefully: log warning + return 0 metrics (UI hiển thị "not available")
 * thay vì throw để tránh fail toàn bộ insight cycle.
 */
@Injectable()
export class TikTokInsightProvider implements InsightProvider {
  readonly platform = 'TIKTOK' as const
  private readonly logger = new Logger(TikTokInsightProvider.name)

  async fetchPostMetrics(account: SocialAccount, accessToken: string, platformPostId: string): Promise<RawMetrics> {
    const url = `${TT}/research/video/query/`
    const body = {
      query: {
        and: [
          { operation: 'EQ', field_name: 'video_id', field_values: [platformPostId] },
        ],
      },
      fields: POST_METRIC_FIELDS,
    }

    let data: TikTokResearchResponse
    try {
      const res = await axios.post<TikTokResearchResponse>(url, body, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15_000,
      })
      data = res.data
    }
    catch (err) {
      return this.handlePostMetricsError(err, account, platformPostId)
    }

    const video = data.data?.videos?.[0]
    if (!video) {
      this.logger.warn(`TT insight: no video data for ${platformPostId} (account=${account.id})`)
      return this.emptyMetrics()
    }
    return {
      views: video.view_count ?? 0,
      likes: video.like_count ?? 0,
      comments: video.comment_count ?? 0,
      shares: video.share_count ?? 0,
      saves: 0,                            // TT Research API không expose save count cho video query
      reachUnique: 0,                      // TT không expose unique reach
      raw: { research: video },
    }
  }

  async fetchAccountFollowers(_account: SocialAccount, accessToken: string): Promise<number> {
    const url = `${TT}/user/info/?fields=follower_count`
    try {
      const res = await axios.get<TikTokUserInfoResponse>(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10_000,
      })
      return res.data.data?.user?.follower_count ?? 0
    }
    catch (err) {
      this.mapErrorAndThrow(err, 'followers')
    }
  }

  /**
   * Research API có thể 403 nếu user/app không có scope — fallback empty thay vì
   * throw để insight cycle vẫn pass cho các platform khác.
   * Các lỗi khác (401 token, 429 rate, 5xx) vẫn map bình thường.
   */
  private handlePostMetricsError(err: unknown, account: SocialAccount, postId: string): RawMetrics {
    const status = (err as { response?: { status?: number } }).response?.status
    const data = (err as { response?: { data?: unknown } }).response?.data
    if (status === 401) {
      throw new AppException(ResponseCode.AccountTokenExpired, { provider: 'tiktok', stage: 'post-metrics' })
    }
    if (status === 429) {
      throw new RetryableError('TT rate limit @post-metrics')
    }
    if (status && status >= 500) {
      throw new RetryableError(`TT 5xx @post-metrics (${status})`)
    }
    if (status === 403 || status === 400) {
      this.logger.warn(
        `TT Research API unavailable for account=${account.id} post=${postId} status=${status} — return empty metrics`,
      )
      return this.emptyMetrics()
    }
    this.logger.warn(`TT insight unknown error status=${status} ${JSON.stringify(data)}`)
    throw new AppException(ResponseCode.InsightFetchFailed, { provider: 'tiktok', stage: 'post-metrics', details: data })
  }

  private mapErrorAndThrow(err: unknown, stage: string): never {
    const status = (err as { response?: { status?: number } }).response?.status
    const data = (err as { response?: { data?: unknown } }).response?.data
    if (status === 401 || status === 403) {
      throw new AppException(ResponseCode.AccountTokenExpired, { provider: 'tiktok', stage })
    }
    if (status === 429) {
      throw new RetryableError(`TT rate limit @${stage}`)
    }
    if (status && status >= 500) {
      throw new RetryableError(`TT 5xx @${stage} (${status})`)
    }
    throw new AppException(ResponseCode.InsightFetchFailed, { provider: 'tiktok', stage, details: data })
  }

  private emptyMetrics(): RawMetrics {
    return {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      reachUnique: 0,
      raw: { fallback: 'tt_research_unavailable' },
    }
  }
}

interface TikTokResearchVideo {
  video_id?: string
  view_count?: number
  like_count?: number
  comment_count?: number
  share_count?: number
}

interface TikTokResearchResponse {
  data?: { videos?: TikTokResearchVideo[] }
}

interface TikTokUserInfoResponse {
  data?: { user?: { follower_count?: number } }
}
