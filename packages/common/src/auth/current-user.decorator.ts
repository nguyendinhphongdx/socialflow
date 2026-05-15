import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { AuthUser } from './auth-user.type'

/**
 * Inject `req.user` (đã set qua JwtStrategy.validate).
 *
 * Usage:
 * ```ts
 * @Get('/me')
 * me(@CurrentUser() user: AuthUser) { ... }
 *
 * @Get('/posts')
 * list(@CurrentUser('id') userId: string) { ... }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] | null => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>()
    const user = request.user
    if (!user) return null
    return data ? user[data] : user
  },
)
