import { SetMetadata } from '@nestjs/common'
import { REQUIRED_SCOPES_METADATA, type ApiKeyScope } from './api-key.constants'

/**
 * Đánh dấu endpoint yêu cầu API key có 1+ scope cụ thể.
 *
 * - Request authed bằng JWT (user session) → bypass scope check (full access).
 * - Request authed bằng API key → check `req.apiKeyScopes` chứa **tất cả** scope yêu cầu.
 *
 * Usage:
 * ```ts
 * @RequireScopes(ApiKeyScope.PUBLISH_WRITE)
 * @Post('/publish')
 * createPublish() { ... }
 * ```
 */
export const RequireScopes = (
  ...scopes: ApiKeyScope[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_SCOPES_METADATA, scopes)
