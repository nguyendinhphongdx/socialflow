import type { AccountPlatform } from '@/features/accounts'

export interface AutoReplyRule {
  id: string
  name: string
  enabled: boolean
  platforms: AccountPlatform[]
  accountIds: string[]
  keywordsAny: string[]
  keywordsAll: string[]
  keywordsNone: string[]
  replyTemplate: string
  replyDelaySec: number
  maxRepliesPerDay: number
  matchCount: number
  replyCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateAutoReplyRuleInput {
  name: string
  enabled: boolean
  platforms: AccountPlatform[]
  accountIds: string[]
  keywordsAny: string[]
  keywordsAll: string[]
  keywordsNone: string[]
  replyTemplate: string
  replyDelaySec: number
  maxRepliesPerDay: number
}

export interface UpdateAutoReplyRuleInput {
  name?: string
  enabled?: boolean
  platforms?: AccountPlatform[]
  accountIds?: string[]
  keywordsAny?: string[]
  keywordsAll?: string[]
  keywordsNone?: string[]
  replyTemplate?: string
  replyDelaySec?: number
  maxRepliesPerDay?: number
}

export interface ListRulesQuery {
  page?: number
  pageSize?: number
  enabled?: boolean
  platform?: AccountPlatform
}

export interface AutoReplyRuleListResponse {
  list: AutoReplyRule[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
