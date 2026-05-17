import {
  type ExecutionContext,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { AppException, IS_PUBLIC_KEY, ResponseCode, type AuthUser } from '@sociflow/common'
import { RequestContextService } from '../context/request-context.service'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly context: RequestContextService,
  ) {
    super()
  }

  override canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (isPublic) return true
    return super.canActivate(ctx)
  }

  override handleRequest<TUser extends AuthUser>(
    err: unknown,
    user: TUser | false,
    _info: unknown,
    _ctx: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw new AppException(ResponseCode.AuthRequired)
    }
    this.context.set({ userId: user.id, sessionId: user.sessionId })
    // F-716 — workspaceId từ token claim. Có thể bị WorkspaceContextGuard override
    // sau qua `X-Workspace-Id` header (sau khi verify membership).
    if (user.workspaceId) {
      this.context.setWorkspaceId(user.workspaceId)
    }
    return user
  }
}
