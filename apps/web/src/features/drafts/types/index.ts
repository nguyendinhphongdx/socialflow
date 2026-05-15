export interface Draft {
  id: string
  title: string | null
  body: string | null
  mediaIds: string[]
  platformOptions: Record<string, unknown> | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateDraftInput {
  title?: string
  body?: string
  mediaIds: string[]
  platformOptions?: Record<string, unknown>
  tags: string[]
}

export interface UpdateDraftInput {
  title?: string
  body?: string
  mediaIds?: string[]
  platformOptions?: Record<string, unknown>
  tags?: string[]
}

export interface PublishDraftInput {
  accountIds: string[]
  publishTime?: string                       // ISO string, omit = publish now
  idempotencyKey?: string
}

export interface ListDraftQuery {
  page?: number
  pageSize?: number
  tag?: string
}

export interface DraftListResponse {
  list: Draft[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface DraftPublishResult {
  id: string
  accountId: string
  flowId: string | null
  status:
    | 'PENDING' | 'SCHEDULED' | 'WAITING_AGENT' | 'DISPATCHED' | 'IN_PROGRESS'
    | 'REVIEW_PENDING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED' | 'REJECTED'
  publishTime: string
}
