import { type ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { AuthUser } from '@sociflow/common'
import { RequestContextService } from '../context/request-context.service'

/**
 * Guard cho endpoint hoạt động cả anonymous lẫn authed.
 *
 * - Có JWT hợp lệ → set `req.user` + populate CLS
 * - Không có / invalid → `req.user = null`, không throw
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly context: RequestContextService) {
    super()
  }

  override handleRequest<TUser extends AuthUser>(
    _err: unknown,
    user: TUser | false,
    _info: unknown,
    _ctx: ExecutionContext,
  ): TUser | null {
    if (!user) return null
    this.context.set({ userId: user.id, sessionId: user.sessionId })
    return user
  }
}
