import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common'
import { AppException, constantTimeEqual, ResponseCode } from '@sociflow/common'

export const INTERNAL_TOKEN_OPTIONS = 'INTERNAL_TOKEN_OPTIONS'

export interface InternalTokenOptions {
  expectedToken: string
  headerName?: string              // default 'x-internal-token'
}

/**
 * Guard cho mọi route prefix `/internal/*` trên apps/ai (và apps/api nếu có endpoint nội bộ).
 *
 * - Verify `X-Internal-Token` header bằng constant-time equality (chống timing attack)
 * - Reject nếu thiếu / sai
 */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(
    @Inject(INTERNAL_TOKEN_OPTIONS) private readonly options: InternalTokenOptions,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest<{ headers?: Record<string, string | string[] | undefined> }>()
    const headerName = (this.options.headerName ?? 'x-internal-token').toLowerCase()
    const raw = request.headers?.[headerName]
    const token = Array.isArray(raw) ? raw[0] : raw
    if (!token || !constantTimeEqual(token, this.options.expectedToken)) {
      throw new AppException(ResponseCode.AuthRequired, { reason: 'internal_token_required' })
    }
    return true
  }
}
