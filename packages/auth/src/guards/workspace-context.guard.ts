import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AppException, IS_PUBLIC_KEY, ResponseCode, type AuthUser } from '@sociflow/common'
import type { Request } from 'express'
import { RequestContextService } from '../context/request-context.service'

/**
 * Token cho membership resolver — implement bởi WorkspaceModule, inject vào guard.
 * Tách interface để package `@sociflow/auth` không phụ thuộc Prisma model.
 */
export const WORKSPACE_MEMBERSHIP_RESOLVER = 'WORKSPACE_MEMBERSHIP_RESOLVER'

export interface WorkspaceMembershipResolver {
  /**
   * Tìm membership của user trong workspace. Return null nếu không phải member.
   * Cũng dùng cho fallback: nếu workspaceId không cung cấp, resolve personal
   * workspace của user (isPersonal=true) — first match.
   */
  findMembership(userId: string, workspaceId: string): Promise<{ role: string } | null>

  /**
   * Resolve personal workspace ID của user (fallback khi token cũ không có
   * workspaceId claim). Return null nếu user chưa có workspace nào (newly
   * migrated từ legacy chưa backfill).
   */
  resolvePersonalWorkspaceId(userId: string): Promise<string | null>
}

export const WORKSPACE_ROLE_KEY = 'sociflow:workspaceRole'

const ROLE_RANK: Record<string, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
}

/**
 * Guard chạy sau JwtAuthGuard. Resolve workspace context:
 * 1. Đọc `req.user.workspaceId` (từ token claim) hoặc `X-Workspace-Id` header (override).
 * 2. Fallback: resolve personal workspace của user nếu token chưa có claim.
 * 3. Verify membership — không phải member → throw WorkspaceAccessDenied.
 * 4. Set workspaceId + role vào CLS context cho downstream service.
 * 5. Nếu method có `@RequireWorkspaceRole(role)` — verify role >= required.
 *
 * Bypass cho `@Public()` endpoint (login, webhook, health).
 */
@Injectable()
export class WorkspaceContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly ctx: RequestContextService,
    @Inject(WORKSPACE_MEMBERSHIP_RESOLVER)
    private readonly resolver: WorkspaceMembershipResolver,
  ) {}

  async canActivate(execCtx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      execCtx.getHandler(),
      execCtx.getClass(),
    ])
    if (isPublic) return true

    const req = execCtx.switchToHttp().getRequest<Request & { user?: AuthUser, workspaceId?: string, workspaceRole?: string }>()
    const user = req.user
    if (!user) {
      // JwtAuthGuard đã chạy trước — user phải có. Nếu undefined nghĩa là route
      // gắn guard này nhưng quên JwtAuthGuard → fail-safe.
      throw new AppException(ResponseCode.AuthRequired)
    }

    // Override header — verify membership trước khi accept
    const headerWorkspaceId = this.extractHeaderWorkspaceId(req)
    let workspaceId = headerWorkspaceId ?? user.workspaceId

    // Fallback: token cũ không có workspaceId → resolve personal workspace
    if (!workspaceId) {
      workspaceId = (await this.resolver.resolvePersonalWorkspaceId(user.id)) ?? undefined
    }

    if (!workspaceId) {
      throw new AppException(ResponseCode.WorkspaceAccessDenied)
    }

    const membership = await this.resolver.findMembership(user.id, workspaceId)
    if (!membership) {
      throw new AppException(ResponseCode.WorkspaceAccessDenied, { workspaceId })
    }

    // Set vào request + CLS context
    req.workspaceId = workspaceId
    req.workspaceRole = membership.role
    user.workspaceId = workspaceId
    this.ctx.set({ workspaceId, workspaceRole: membership.role })

    // Check role requirement (nếu có @RequireWorkspaceRole)
    const requiredRole = this.reflector.getAllAndOverride<string>(WORKSPACE_ROLE_KEY, [
      execCtx.getHandler(),
      execCtx.getClass(),
    ])
    if (requiredRole) {
      const have = ROLE_RANK[membership.role] ?? 0
      const need = ROLE_RANK[requiredRole] ?? 0
      if (have < need) {
        throw new AppException(ResponseCode.WorkspaceInsufficientRole, {
          required: requiredRole,
          actual: membership.role,
        })
      }
    }

    return true
  }

  private extractHeaderWorkspaceId(req: Request): string | undefined {
    const raw = req.headers?.['x-workspace-id']
    if (typeof raw === 'string' && raw.length > 0) return raw
    if (Array.isArray(raw) && raw.length > 0) return raw[0]
    return undefined
  }
}
