import type { AccountPlatform } from '@/features/accounts'

export interface PostInsight {
  id: string
  publishRecordId: string
  platform: AccountPlatform
  accountId: string
  snapshotAt: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number | null
  reach: number | null
  impressions: number | null
  engagementRate: number | null
  rawPayload: unknown | null
  createdAt: string
}

export interface AccountTimelinePoint {
  date: string
  followers: number
  followersDelta: number
  totalPosts: number
  totalEngagement: number
  reach: number
}

export interface AccountTimelineResponse {
  list: AccountTimelinePoint[]
}
