import { Injectable } from '@nestjs/common'
import { AppException, ResponseCode } from '@sociflow/common'
import type { SocialAccount } from '@prisma/client'
import type { InsightProvider, RawMetrics } from './insight-provider.interface'

/**
 * InstagramInsightProvider — STUB Phase 6.
 *
 * Real implementation:
 * - `/{ig_media_id}/insights?metric=impressions,reach,saved,engagement` cho post
 * - `/{ig_user_id}?fields=followers_count`
 * Cần scope `instagram_basic` + `instagram_manage_insights` + Graph approval.
 */
@Injectable()
export class InstagramInsightProvider implements InsightProvider {
  readonly platform = 'INSTAGRAM' as const

  async fetchPostMetrics(_account: SocialAccount, _token: string, _platformPostId: string): Promise<RawMetrics> {
    throw new AppException(ResponseCode.InsightFetchFailed, {
      provider: 'instagram',
      reason: 'ig_not_implemented_phase_6',
    })
  }

  async fetchAccountFollowers(_account: SocialAccount, _token: string): Promise<number> {
    throw new AppException(ResponseCode.InsightFetchFailed, {
      provider: 'instagram',
      reason: 'ig_followers_not_implemented_phase_6',
    })
  }
}
