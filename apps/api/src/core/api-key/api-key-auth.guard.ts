import {
  type ExecutionContext,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import type { Request } from 'express'
import { AppException, ResponseCode, type AuthUser } from '@sociflow/common'
import { Inject } from '@nestjs/common'
import {
  RequestContextService,
  WORKSPACE_MEMBERSHIP_RESOLVER,
  type WorkspaceMembershipResolver,
} from '@sociflow/auth'
import { API_KEY_HEADER, REQUIRED_SCOPES_METADATA, type ApiKeyScope } from './api-key.constants'
import { ApiKeyService } from './api-key.service'

/**
 * Guard cho endpoint hỗ trợ cả JWT (session user) và API key (3rd-party).
 *
 * Workflow:
 *  - Có header `X-API-Key` → validate qua `ApiKeyService`:
 *      - Match + scope đủ → populate `req.user`, `req.apiKeyScopes`, CLS context.
 *      - Sai key / revoked / expired / thiếu scope → throw `AppException`.
 *  - Không có header → delegate sang Passport JWT strategy (cookie or Bearer).
 *    JWT user có **full** scope → bypass `@RequireScopes`.
 *
 * Đi kèm `@Public()` ở controller / handler để bypass global `JwtAuthGuard`
 * (vì guard này tự xử lý JWT path khi cần). Nếu route đã có global JWT thì
 * không cần `@Public()` — guard này đứng ngang JWT, fail-open khi key thiếu.
 */
@Injectable()
export class ApiKeyAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly context: RequestContextService,
    private readonly reflector: Reflector,
    @Inject(WORKSPACE_MEMBERSHIP_RESOLVER)
    private readonly workspaceResolver: WorkspaceMembershipResolver,
  ) {
    super()
  }

  override async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestWithApiKey>()
    const headerValue = req.headers[API_KEY_HEADER]
    const rawKey = Array.isArray(headerValue) ? headerValue[0] : headerValue

    if (rawKey) {
      return this.authenticateByApiKey(ctx, req, rawKey)
    }

    // Không có API key → delegate sang passport JWT (đọc cookie hoặc Bearer).
    const result = await super.canActivate(ctx)
    return result === true
  }

  override handleRequest<TUser extends AuthUser>(
    err: unknown,
    user: TUser | false,
    _info: unknown,
    ctx: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw new AppException(ResponseCode.AuthRequired)
    }
    const req = ctx.switchToHttp().getRequest<RequestWithApiKey>()
    req.user = user
    this.context.set({ userId: user.id, sessionId: user.sessionId })
    // F-716 — JWT path: workspaceId từ token claim. Nếu thiếu, resolver fallback
    // sẽ chạy ở downstream service hoặc resolve trong middleware tiếp theo (best effort).
    if (user.workspaceId) {
      this.context.setWorkspaceId(user.workspaceId)
    }
    return user
  }

  private async authenticateByApiKey(
    ctx: ExecutionContext,
    req: RequestWithApiKey,
    rawKey: string,
  ): Promise<true> {
    const result = await this.apiKeyService.validate(rawKey, {
      endpoint: req.originalUrl ?? req.url,
      ip: req.ip,
    })
    if (!result) {
      throw new AppException(ResponseCode.ApiKeyInvalid)
    }

    const requiredScopes = this.reflector.getAllAndOverride<ApiKeyScope[] | undefined>(
      REQUIRED_SCOPES_METADATA,
      [ctx.getHandler(), ctx.getClass()],
    )
    if (requiredScopes && requiredScopes.length > 0) {
      const missing = requiredScopes.filter(s => !result.scopes.includes(s))
      if (missing.length > 0) {
        throw new AppException(ResponseCode.ApiKeyInsufficientScope, {
          required: requiredScopes,
          granted: result.scopes,
          missing,
        })
      }
    }

    // F-716 — API key inherits user's personal workspace. Follow-up v2.1 sẽ
    // cho phép bind API key vào workspace cụ thể (workspaceId column on ApiKey).
    const workspaceId = await this.workspaceResolver.resolvePersonalWorkspaceId(result.user.id)
    const authUser: AuthUser = {
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      sessionId: `api-key:${result.apiKey.id}`,
      isVerified: result.user.emailVerified,
      workspaceId: workspaceId ?? undefined,
    }
    req.user = authUser
    req.apiKeyScopes = result.scopes
    req.apiKeyId = result.apiKey.id
    this.context.set({ userId: authUser.id, sessionId: authUser.sessionId })
    if (workspaceId) this.context.setWorkspaceId(workspaceId)
    return true
  }
}

interface RequestWithApiKey extends Request {
  user?: AuthUser
  apiKeyScopes?: string[]
  apiKeyId?: string
}
