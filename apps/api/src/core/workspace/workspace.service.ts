import { Injectable, Logger } from '@nestjs/common'
import type { Workspace, WorkspaceMember, WorkspaceRole } from '@prisma/client'
import { AppException, ResponseCode } from '@sociflow/common'
import { RequestContextService, type WorkspaceMembershipResolver } from '@sociflow/auth'
import { UserRepository } from '../user/user.repository'
import { WorkspaceRepository } from './workspace.repository'
import type { CreateWorkspaceDto, InviteMemberDto, UpdateMemberRoleDto, UpdateWorkspaceDto } from './workspace.dto'

@Injectable()
export class WorkspaceService implements WorkspaceMembershipResolver {
  private readonly logger = new Logger(WorkspaceService.name)

  constructor(
    private readonly repo: WorkspaceRepository,
    private readonly userRepo: UserRepository,
    private readonly ctx: RequestContextService,
  ) {}

  // ============================================
  // WorkspaceMembershipResolver — invoked bởi WorkspaceContextGuard
  // ============================================

  async findMembership(userId: string, workspaceId: string): Promise<{ role: string } | null> {
    const member = await this.repo.findMembership(userId, workspaceId)
    return member ? { role: member.role } : null
  }

  async resolvePersonalWorkspaceId(userId: string): Promise<string | null> {
    const ws = await this.repo.getPersonalByOwnerId(userId)
    return ws?.id ?? null
  }

  // ============================================
  // Personal workspace bootstrap — gọi từ AuthService.register
  // ============================================

  /**
   * Tạo personal workspace cho user mới. Idempotent — nếu user đã có personal
   * workspace (vd Google OAuth login lần 2 nhưng register sai luồng), trả về luôn.
   */
  async ensurePersonalWorkspace(userId: string, displayName: string | null): Promise<Workspace> {
    const existing = await this.repo.getPersonalByOwnerId(userId)
    if (existing) return existing

    const slug = await this.generateUniqueSlug(`personal-${userId.slice(0, 16)}`)
    const name = `${displayName ?? 'My'}'s workspace`
    const ws = await this.repo.createWithOwner({
      name,
      slug,
      isPersonal: true,
      ownerId: userId,
    })
    this.logger.log(`Created personal workspace ${ws.id} for user ${userId}`)
    return ws
  }

  // ============================================
  // User-facing endpoints
  // ============================================

  async listMembershipsForCurrentUser() {
    const userId = this.ctx.requireUserId()
    return this.repo.listMembershipsByUserId(userId)
  }

  async getCurrentWorkspace(): Promise<{ workspace: Workspace, role: WorkspaceRole }> {
    const userId = this.ctx.requireUserId()
    const workspaceId = this.ctx.requireWorkspaceId()
    const workspace = await this.repo.getById(workspaceId)
    if (!workspace) throw new AppException(ResponseCode.WorkspaceNotFound, { workspaceId })
    const membership = await this.repo.findMembership(userId, workspaceId)
    if (!membership) throw new AppException(ResponseCode.WorkspaceAccessDenied, { workspaceId })
    return { workspace, role: membership.role }
  }

  async createTeamWorkspace(dto: CreateWorkspaceDto): Promise<Workspace> {
    const userId = this.ctx.requireUserId()
    const existing = await this.repo.getBySlug(dto.slug)
    if (existing) throw new AppException(ResponseCode.WorkspaceMemberAlreadyExists, { slug: dto.slug })

    const ws = await this.repo.createWithOwner({
      name: dto.name,
      slug: dto.slug,
      isPersonal: false,
      ownerId: userId,
    })
    this.logger.log(`User ${userId} created team workspace ${ws.id}`)
    return ws
  }

  async updateById(id: string, dto: UpdateWorkspaceDto): Promise<Workspace> {
    const userId = this.ctx.requireUserId()
    await this.assertRoleAtLeast(userId, id, 'ADMIN')
    return this.repo.updateById(id, {
      ...(dto.name !== undefined && { name: dto.name }),
    })
  }

  async softDeleteById(id: string): Promise<void> {
    const userId = this.ctx.requireUserId()
    const workspace = await this.repo.getById(id)
    if (!workspace) throw new AppException(ResponseCode.WorkspaceNotFound, { workspaceId: id })
    if (workspace.isPersonal) throw new AppException(ResponseCode.WorkspaceCannotDeletePersonal)
    await this.assertRoleAtLeast(userId, id, 'OWNER')
    await this.repo.softDeleteById(id)
    this.logger.log(`Workspace ${id} soft-deleted by user ${userId}`)
  }

  // ============================================
  // Members
  // ============================================

  async listMembers(workspaceId: string) {
    const userId = this.ctx.requireUserId()
    await this.assertRoleAtLeast(userId, workspaceId, 'VIEWER')
    return this.repo.listMembersByWorkspaceId(workspaceId)
  }

  async inviteMember(workspaceId: string, dto: InviteMemberDto): Promise<WorkspaceMember> {
    const inviterId = this.ctx.requireUserId()
    await this.assertRoleAtLeast(inviterId, workspaceId, 'ADMIN')

    const invitee = await this.userRepo.getByEmail(dto.email)
    if (!invitee) throw new AppException(ResponseCode.UserNotFound, { email: dto.email })

    const existing = await this.repo.findMembership(invitee.id, workspaceId)
    if (existing) throw new AppException(ResponseCode.WorkspaceMemberAlreadyExists, { userId: invitee.id })

    const member = await this.repo.addMember({
      workspaceId,
      userId: invitee.id,
      role: dto.role,
      invitedBy: inviterId,
    })
    this.logger.log(`User ${inviterId} invited ${invitee.id} as ${dto.role} to workspace ${workspaceId}`)
    return member
  }

  async updateMemberRole(workspaceId: string, targetUserId: string, dto: UpdateMemberRoleDto): Promise<WorkspaceMember> {
    const actorId = this.ctx.requireUserId()
    await this.assertRoleAtLeast(actorId, workspaceId, 'ADMIN')

    // Không cho phép downgrade OWNER qua endpoint này — transfer ownership là flow riêng.
    const target = await this.repo.findMembership(targetUserId, workspaceId)
    if (!target) throw new AppException(ResponseCode.WorkspaceNotFound, { userId: targetUserId })
    if (target.role === 'OWNER') {
      throw new AppException(ResponseCode.WorkspaceInsufficientRole, {
        reason: 'cannot_downgrade_owner',
      })
    }

    return this.repo.updateMemberRole(workspaceId, targetUserId, dto.role)
  }

  async removeMember(workspaceId: string, targetUserId: string): Promise<void> {
    const actorId = this.ctx.requireUserId()
    await this.assertRoleAtLeast(actorId, workspaceId, 'ADMIN')

    const target = await this.repo.findMembership(targetUserId, workspaceId)
    if (!target) throw new AppException(ResponseCode.WorkspaceNotFound, { userId: targetUserId })
    if (target.role === 'OWNER') {
      throw new AppException(ResponseCode.WorkspaceInsufficientRole, {
        reason: 'cannot_remove_owner',
      })
    }

    await this.repo.removeMember(workspaceId, targetUserId)
    this.logger.log(`User ${actorId} removed member ${targetUserId} from workspace ${workspaceId}`)
  }

  // ============================================
  // Internal helpers
  // ============================================

  private async assertRoleAtLeast(userId: string, workspaceId: string, required: WorkspaceRole): Promise<WorkspaceMember> {
    const membership = await this.repo.findMembership(userId, workspaceId)
    if (!membership) throw new AppException(ResponseCode.WorkspaceAccessDenied, { workspaceId })
    const rank: Record<WorkspaceRole, number> = { VIEWER: 1, EDITOR: 2, ADMIN: 3, OWNER: 4 }
    if (rank[membership.role] < rank[required]) {
      throw new AppException(ResponseCode.WorkspaceInsufficientRole, {
        required,
        actual: membership.role,
      })
    }
    return membership
  }

  private async generateUniqueSlug(base: string): Promise<string> {
    let slug = base
    let attempt = 0
    while (await this.repo.getBySlug(slug)) {
      attempt += 1
      slug = `${base}-${attempt}`
      if (attempt > 100) throw new AppException(ResponseCode.InternalError, { reason: 'slug_collision' })
    }
    return slug
  }
}
