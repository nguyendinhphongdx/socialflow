/**
 * API key scopes — quy định endpoint nào key được phép gọi.
 *
 * String value lưu trong DB `ApiKey.scopes[]`. Khi kiểm tra qua `@RequireScopes`,
 * guard so khớp string trực tiếp (không cần map sang enum).
 */
export const ApiKeyScope = {
  PUBLISH_READ: 'publish:read',
  PUBLISH_WRITE: 'publish:write',
  INSIGHT_READ: 'insight:read',
  COMMENT_READ: 'comment:read',
  COMMENT_WRITE: 'comment:write',
  AI_GENERATE: 'ai:generate',
} as const

export type ApiKeyScope = (typeof ApiKeyScope)[keyof typeof ApiKeyScope]

export const API_KEY_SCOPES = Object.values(ApiKeyScope)

/** Prefix length hiển thị sau "sf_<env>_". 8 chars random. */
export const KEY_PREFIX_RANDOM_LEN = 8
/** Secret payload (random) length sau prefix. */
export const KEY_SECRET_RANDOM_BYTES = 32

/** Header name nhận API key từ client. */
export const API_KEY_HEADER = 'x-api-key'

/** Metadata key cho `@RequireScopes`. */
export const REQUIRED_SCOPES_METADATA = 'sociflow:apiKeyScopes'
