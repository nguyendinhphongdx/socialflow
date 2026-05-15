export type AccountPlatform = 'YOUTUBE' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK'
export type AccountStatus = 'ACTIVE' | 'TOKEN_EXPIRED' | 'REVOKED' | 'SUSPENDED'
export type PublishMode = 'API' | 'AUTOMATION' | 'HYBRID'

export interface SocialAccount {
  id: string
  platform: AccountPlatform
  platformUid: string
  displayName: string
  avatarUrl: string | null
  publishMode: PublishMode
  status: AccountStatus
  scopes: string[]
  tokenExpiresAt: string | null
  lastSyncAt: string | null
  metadata: unknown | null
  groupId: string | null
  createdAt: string
  updatedAt: string
}

export interface ListAccountsQuery {
  page?: number
  pageSize?: number
  platform?: AccountPlatform
  status?: AccountStatus
}
