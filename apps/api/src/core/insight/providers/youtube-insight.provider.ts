import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { AppException, ResponseCode, RetryableError } from '@sociflow/common'
import type { SocialAccount } from '@prisma/client'
import type { InsightProvider, RawMetrics } from './insight-provider.interface'

const YT_VIDEOS = 'https://www.googleapis.com/youtube/v3/videos'
const YT_CHANNELS = 'https://www.googleapis.com/youtube/v3/channels'

/**
 * YouTubeInsightProvider — fetch metric video qua Data API v3.
 *
 * Endpoint:
 * - GET /videos?id={vid}&part=statistics → { viewCount, likeCount, commentCount, favoriteCount }
 * - GET /channels?mine=true&part=statistics → { subscriberCount }
 *
 * Quota: 1 unit per call (videos.list, channels.list) — rẻ.
 * Lưu ý: `dislikeCount` đã ẩn public từ 2021.
 */
@Injectable()
export class YouTubeInsightProvider implements InsightProvider {
  readonly platform = 'YOUTUBE' as const
  private readonly logger = new Logger(YouTubeInsightProvider.name)

  async fetchPostMetrics(_account: SocialAccount, accessToken: string, platformPostId: string): Promise<RawMetrics> {
    try {
      const url = `${YT_VIDEOS}?id=${encodeURIComponent(platformPostId)}&part=statistics`
      const res = await axios.get<YouTubeVideosResponse>(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10_000,
      })
      const stats = res.data.items?.[0]?.statistics
      if (!stats) {
        throw new AppException(ResponseCode.InsightFetchFailed, {
          provider: 'youtube',
          reason: 'video_not_found',
          videoId: platformPostId,
        })
      }
      return {
        views: this.parseCount(stats.viewCount),
        likes: this.parseCount(stats.likeCount),
        comments: this.parseCount(stats.commentCount),
        shares: 0,                               // YT không expose share count
        saves: this.parseCount(stats.favoriteCount),
        reachUnique: 0,                          // YT không expose unique reach trong public stats
        raw: { statistics: stats },
      }
    }
    catch (err) {
      if (err instanceof AppException) throw err
      this.mapErrorAndThrow(err, 'post-metrics')
    }
  }

  async fetchAccountFollowers(_account: SocialAccount, accessToken: string): Promise<number> {
    try {
      const url = `${YT_CHANNELS}?mine=true&part=statistics`
      const res = await axios.get<YouTubeChannelsResponse>(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10_000,
      })
      const stats = res.data.items?.[0]?.statistics
      if (!stats) return 0
      return this.parseCount(stats.subscriberCount)
    }
    catch (err) {
      this.mapErrorAndThrow(err, 'followers')
    }
  }

  private parseCount(value: string | undefined): number {
    if (!value) return 0
    const n = Number.parseInt(value, 10)
    return Number.isFinite(n) ? n : 0
  }

  private mapErrorAndThrow(err: unknown, stage: string): never {
    const status = (err as { response?: { status?: number } }).response?.status
    const data = (err as { response?: { data?: unknown } }).response?.data
    if (status === 401 || status === 403) {
      throw new AppException(ResponseCode.AccountTokenExpired, { provider: 'youtube', stage })
    }
    if (status === 429) {
      throw new RetryableError(`YT quota exceeded @${stage}`)
    }
    if (status && status >= 500) {
      throw new RetryableError(`YT 5xx @${stage} (${status})`)
    }
    this.logger.warn(`YT insight error stage=${stage} status=${status}`)
    throw new AppException(ResponseCode.InsightFetchFailed, { provider: 'youtube', stage, details: data })
  }
}

interface YouTubeStatistics {
  viewCount?: string
  likeCount?: string
  commentCount?: string
  favoriteCount?: string
}

interface YouTubeVideosResponse {
  items?: Array<{ statistics?: YouTubeStatistics }>
}

interface YouTubeChannelStatistics {
  subscriberCount?: string
  viewCount?: string
  videoCount?: string
}

interface YouTubeChannelsResponse {
  items?: Array<{ statistics?: YouTubeChannelStatistics }>
}
