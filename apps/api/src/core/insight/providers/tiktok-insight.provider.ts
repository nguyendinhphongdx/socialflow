import { Injectable } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import type { SocialAccount } from '@prisma/client'
import type { InsightProvider, RawMetrics } from './insight-provider.interface'

/**
 * TikTokInsightProvider — STUB Phase 6.
 *
 * Real implementation cần Display API + Research API:
 * - Display API trả basic info, không có metric
 * - Research API yêu cầu academic / business approval cho metric chi tiết
 */
@Injectable()
export class TikTokInsightProvider implements InsightProvider {
  readonly platform = 'TIKTOK' as const

  async fetchPostMetrics(_account: SocialAccount, _token: string, _platformPostId: string): Promise<RawMetrics> {
    throw new AppException(ResponseCode.InsightFetchFailed, {
      provider: 'tiktok',
      reason: 'tt_not_implemented',
    })
  }

  async fetchAccountFollowers(_account: SocialAccount, _token: string): Promise<number> {
    throw new AppException(ResponseCode.InsightFetchFailed, {
      provider: 'tiktok',
      reason: 'tt_followers_not_implemented',
    })
  }
}
