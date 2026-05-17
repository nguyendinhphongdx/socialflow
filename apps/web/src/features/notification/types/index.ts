export interface PushSubscriptionPayload {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  deviceTag?: string
}

export interface PushSubscriptionVo {
  id: string
  endpoint: string
  deviceTag: string | null
  createdAt: string
  lastUsed: string | null
}

export interface PushSubscriptionListVo {
  list: PushSubscriptionVo[]
  total: number
}
