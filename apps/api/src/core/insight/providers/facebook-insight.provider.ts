import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { AppException, ResponseCode, RetryableError } from '@sociflow/common'
import type { SocialAccount } from '@prisma/client'
import type { InsightProvider, RawMetrics } from './insight-provider.interface'

const GRAPH = 'https://graph.facebook.com/v21.0'

/**
 * FacebookInsightProvider — fetch insight cho Facebook Page post.
 *
 * Endpoint chính:
 * - `/{postId}?fields=likes.summary(true),comments.summary(true),shares,reactions.summary(true)`
 * - `/{postId}/insights?metric=post_impressions,post_engaged_users,post_reactions_like_total`
 * - `/{pageId}?fields=followers_count,fan_count`
 *
 * Scope yêu cầu: `pages_read_engagement` + `read_insights`.
 */
@Injectable()
export class FacebookInsightProvider implements InsightProvider {
  readonly platform = 'FACEBOOK' as const
  private readonly logger = new Logger(FacebookInsightProvider.name)

  async fetchPostMetrics(_account: SocialAccount, accessToken: string, platformPostId: string): Promise<RawMetrics> {
    const basic = await this.fetchBasicMetrics(platformPostId, accessToken)
    const insights = await this.fetchInsightMetrics(platformPostId, accessToken)

    const impressions = this.firstMetricValue(insights, 'post_impressions') ?? 0
    const reach = this.firstMetricValue(insights, 'post_impressions_unique') ?? 0

    return {
      views: impressions,
      likes: basic.likesCount,
      comments: basic.commentsCount,
      shares: basic.sharesCount,
      saves: 0,                                // FB không expose post-save
      reachUnique: reach,
      raw: { basic: basic.raw, insights: insights.data ?? [] },
    }
  }

  async fetchAccountFollowers(account: SocialAccount, accessToken: string): Promise<number> {
    try {
      const url = `${GRAPH}/${account.platformUid}?fields=followers_count,fan_count&access_token=${encodeURIComponent(accessToken)}`
      const res = await axios.get<{ followers_count?: number, fan_count?: number }>(url, { timeout: 10_000 })
      return res.data.followers_count ?? res.data.fan_count ?? 0
    }
    catch (err) {
      this.mapErrorAndThrow(err, 'followers')
    }
  }

  private async fetchBasicMetrics(postId: string, accessToken: string) {
    const fields = 'likes.summary(true).limit(0),comments.summary(true).limit(0),shares,reactions.summary(true).limit(0)'
    try {
      const url = `${GRAPH}/${postId}?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`
      const res = await axios.get<FacebookPostBasicResponse>(url, { timeout: 10_000 })
      return {
        likesCount: res.data.likes?.summary?.total_count ?? res.data.reactions?.summary?.total_count ?? 0,
        commentsCount: res.data.comments?.summary?.total_count ?? 0,
        sharesCount: res.data.shares?.count ?? 0,
        raw: res.data as unknown as Record<string, unknown>,
      }
    }
    catch (err) {
      this.mapErrorAndThrow(err, 'basic')
    }
  }

  private async fetchInsightMetrics(postId: string, accessToken: string): Promise<FacebookInsightResponse> {
    const metrics = 'post_impressions,post_impressions_unique,post_engaged_users,post_reactions_like_total'
    try {
      const url = `${GRAPH}/${postId}/insights?metric=${metrics}&access_token=${encodeURIComponent(accessToken)}`
      const res = await axios.get<FacebookInsightResponse>(url, { timeout: 10_000 })
      return res.data
    }
    catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status
      // Một số metric chỉ dành cho video / chỉ pages eligible. 400 từ insight subgraph
      // KHÔNG fatal cho cả post — log + return rỗng.
      if (status === 400) {
        this.logger.warn(`FB insight 400 cho post ${postId} — return empty`)
        return { data: [] }
      }
      this.mapErrorAndThrow(err, 'insights')
    }
  }

  private firstMetricValue(insight: FacebookInsightResponse, metric: string): number | undefined {
    const found = insight.data?.find(d => d.name === metric)
    const value = found?.values?.[0]?.value
    return typeof value === 'number' ? value : undefined
  }

  private mapErrorAndThrow(err: unknown, stage: string): never {
    const status = (err as { response?: { status?: number } }).response?.status
    const data = (err as { response?: { data?: unknown } }).response?.data
    if (status === 401 || status === 403) {
      throw new AppException(ResponseCode.AccountTokenExpired, { provider: 'facebook', stage })
    }
    if (status === 429) {
      throw new RetryableError(`FB rate limit @${stage}`)
    }
    if (status && status >= 500) {
      throw new RetryableError(`FB 5xx @${stage} (${status})`)
    }
    throw new AppException(ResponseCode.InsightFetchFailed, { provider: 'facebook', stage, details: data })
  }
}

interface FacebookPostBasicResponse {
  likes?: { summary?: { total_count?: number } }
  comments?: { summary?: { total_count?: number } }
  reactions?: { summary?: { total_count?: number } }
  shares?: { count?: number }
}

interface FacebookInsightResponse {
  data?: Array<{ name?: string, values?: Array<{ value?: number | unknown }> }>
}
