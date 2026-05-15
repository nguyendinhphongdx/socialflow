export type PublishStatus =
  | 'PENDING' | 'SCHEDULED' | 'WAITING_AGENT' | 'DISPATCHED' | 'IN_PROGRESS'
  | 'REVIEW_PENDING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED' | 'REJECTED'

export interface PublishRecord {
  id: string
  flowId: string | null
  accountId: string
  accountPlatform: 'YOUTUBE' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK'
  accountDisplayName: string
  publishMode: 'API' | 'AUTOMATION' | 'HYBRID'
  title: string | null
  body: string | null
  mediaIds: string[]
  publishTime: string
  publishedAt: string | null
  status: PublishStatus
  stage: string | null
  errorMessage: string | null
  platformPostId: string | null
  workLink: string | null
  retryCount: number
  createdAt: string
  updatedAt: string
}

export interface CreatePublishInput {
  accountIds: string[]
  title?: string
  body?: string
  mediaIds: string[]
  publishTime?: string                     // ISO string, omit = now
  platformOptions?: Record<string, unknown>
  idempotencyKey?: string
}

export interface ListPublishQuery {
  page?: number
  pageSize?: number
  status?: PublishStatus
  accountId?: string
  flowId?: string
}
