import type { AccountPlatform } from '@/features/accounts'

export type SentimentLabel = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
export type MentionStatus = 'NEW' | 'ACKED' | 'ARCHIVED'

export interface BrandMonitor {
  id: string
  name: string
  query: string
  platforms: AccountPlatform[]
  enabled: boolean
  pollIntervalMin: number
  lastPolledAt: string | null
  matchCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateBrandMonitorInput {
  name: string
  query: string
  platforms: AccountPlatform[]
  enabled?: boolean
  pollIntervalMin?: number
}

export interface UpdateBrandMonitorInput {
  name?: string
  query?: string
  platforms?: AccountPlatform[]
  enabled?: boolean
  pollIntervalMin?: number
}

export interface ListBrandMonitorQuery {
  page?: number
  pageSize?: number
  enabled?: boolean
}

export interface BrandMonitorListResponse {
  list: BrandMonitor[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface BrandMention {
  id: string
  monitorId: string
  platform: AccountPlatform
  platformPostId: string | null
  authorName: string | null
  authorPlatformId: string | null
  text: string
  permalink: string | null
  postedAt: string | null
  matchedKeywords: string[]
  sentiment: SentimentLabel | null
  sentimentScore: number | null
  status: MentionStatus
  createdAt: string
  updatedAt: string
}

export interface ListBrandMentionQuery {
  page?: number
  pageSize?: number
  monitorId?: string
  sentiment?: SentimentLabel
  status?: MentionStatus
}

export interface BrandMentionListResponse {
  list: BrandMention[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
