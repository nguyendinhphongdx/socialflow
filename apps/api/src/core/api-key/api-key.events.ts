/**
 * Domain events emitted bởi ApiKeyService.
 * Module khác có thể subscribe qua `@OnEvent('api-key.created')`.
 */
export const API_KEY_EVENTS = {
  CREATED: 'api-key.created',
  USED: 'api-key.used',
  REVOKED: 'api-key.revoked',
} as const

export interface ApiKeyCreatedEvent {
  apiKeyId: string
  userId: string
  scopes: string[]
  prefix: string
  expiresAt: Date | null
}

export interface ApiKeyUsedEvent {
  apiKeyId: string
  userId: string
  scopes: string[]
  /** Endpoint path (vd '/api/v1/publish'). Có thể bỏ trống nếu strategy không inject. */
  endpoint?: string
  ip?: string
}

export interface ApiKeyRevokedEvent {
  apiKeyId: string
  userId: string
  reason?: string
}
