import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { AppException, ResponseCode, RetryableError } from '@sociflow/common'
import type { SocialAccount } from '@prisma/client'
import type { InsightProvider, RawMetrics } from './insight-provider.interface'

const GRAPH = 'https://graph.facebook.com/v21.0'

// IG Insights API trả metrics theo dạng `data: [{ name, values: [{ value }] }, ...]`.
// Yêu cầu IG Business / Creator Account (đã enforce ở connect flow).
// Scope: `instagram_basic` + `instagram_manage_insights` + Meta App Review.
const POST_METRICS = ['impressions', 'reach', 'likes', 'comments', 'saved', 'shares']

/**
 * InstagramInsightProvider — fetch insight cho IG Business media qua Graph API.
 *
 * Endpoint:
 * - GET /{ig_media_id}/insights?metric=impressions,reach,likes,comments,saved,shares
 * - GET /{ig_user_id}?fields=followers_count
 *
 * `account.platformUid` = IG User ID (Business Account ID).
 */
@Injectable()
export class InstagramInsightProvider implements InsightProvider {
  readonly platform = 'INSTAGRAM' as const
  private readonly logger = new Logger(InstagramInsightProvider.name)

  async fetchPostMetrics(_account: SocialAccount, accessToken: string, platformPostId: string): Promise<RawMetrics> {
    const metricCsv = POST_METRICS.join(',')
    const url = `${GRAPH}/${platformPostId}/insights?metric=${metricCsv}&access_token=${encodeURIComponent(accessToken)}`
    let data: InstagramInsightsResponse
    try {
      const res = await axios.get<InstagramInsightsResponse>(url, { timeout: 10_000 })
      data = res.data
    }
    catch (err) {
      this.mapErrorAndThrow(err, 'post-metrics')
    }

    const impressions = this.metricValue(data, 'impressions')
    const reach = this.metricValue(data, 'reach')
    return {
      views: impressions,
      likes: this.metricValue(data, 'likes'),
      comments: this.metricValue(data, 'comments'),
      shares: this.metricValue(data, 'shares'),
      saves: this.metricValue(data, 'saved'),
      reachUnique: reach,
      raw: { insights: data.data ?? [] },
    }
  }

  async fetchAccountFollowers(account: SocialAccount, accessToken: string): Promise<number> {
    const url = `${GRAPH}/${account.platformUid}?fields=followers_count&access_token=${encodeURIComponent(accessToken)}`
    try {
      const res = await axios.get<{ followers_count?: number }>(url, { timeout: 10_000 })
      return res.data.followers_count ?? 0
    }
    catch (err) {
      this.mapErrorAndThrow(err, 'followers')
    }
  }

  private metricValue(data: InstagramInsightsResponse, name: string): number {
    const item = data.data?.find(d => d.name === name)
    const value = item?.values?.[0]?.value
    return typeof value === 'number' ? value : 0
  }

  private mapErrorAndThrow(err: unknown, stage: string): never {
    const status = (err as { response?: { status?: number } }).response?.status
    const data = (err as { response?: { data?: unknown } }).response?.data
    if (status === 401 || status === 403) {
      throw new AppException(ResponseCode.AccountTokenExpired, { provider: 'instagram', stage })
    }
    if (status === 429) {
      throw new RetryableError(`IG rate limit @${stage}`)
    }
    if (status && status >= 500) {
      throw new RetryableError(`IG 5xx @${stage} (${status})`)
    }
    this.logger.warn(`IG insight error stage=${stage} status=${status}`)
    throw new AppException(ResponseCode.InsightFetchFailed, { provider: 'instagram', stage, details: data })
  }
}

interface InstagramInsightsResponse {
  data?: Array<{ name?: string, values?: Array<{ value?: number | unknown }> }>
}
