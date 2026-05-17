import { Injectable } from '@nestjs/common'
import { PrismaService } from '@sociflow/prisma'
import type { Prisma, Workspace, WorkspaceMember, WorkspaceRole } from '@prisma/client'

export type WorkspaceMembershipWithUser = WorkspaceMember & {
  user: { id: string, email: string, name: string | null }
}

export type WorkspaceWithRole = Workspace & { membershipRole: WorkspaceRole }

@Injectable()
export class WorkspaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<Workspace | null> {
    return this.prisma.workspace.findFirst({ where: { id, deletedAt: null } })
  }

  async getBySlug(slug: string): Promise<Workspace | null> {
    return this.prisma.workspace.findFirst({ where: { slug, deletedAt: null } })
  }

  async getPersonalByOwnerId(ownerId: string): Promise<Workspace | null> {
    return this.prisma.workspace.findFirst({
      where: { ownerId, isPersonal: true, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })
  }

  async findMembership(userId: string, workspaceId: string): Promise<WorkspaceMember | null> {
    return this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId, workspace: { deletedAt: null } },
    })
  }

  async listMembershipsByUserId(userId: string): Promise<Array<WorkspaceMember & { workspace: Workspace }>> {
    return this.prisma.workspaceMember.findMany({
      where: { userId, workspace: { deletedAt: null } },
      include: { workspace: true },
      orderBy: { joinedAt: 'asc' },
    })
  }

  async listMembersByWorkspaceId(workspaceId: string): Promise<WorkspaceMembershipWithUser[]> {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { joinedAt: 'asc' },
    })
  }

  async countMembersByWorkspaceId(workspaceId: string): Promise<number> {
    return this.prisma.workspaceMember.count({ where: { workspaceId } })
  }

  async createWithOwner(input: {
    name: string
    slug: string
    isPersonal: boolean
    ownerId: string
  }): Promise<Workspace> {
    // Workspace + WorkspaceMember(OWNER) atomic — đảm bảo invariant 1:1 với owner.
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: input.name,
          slug: input.slug,
          isPersonal: input.isPersonal,
          owner: { connect: { id: input.ownerId } },
        },
      })
      await tx.workspaceMember.create({
        data: {
          workspace: { connect: { id: workspace.id } },
          user: { connect: { id: input.ownerId } },
          role: 'OWNER',
        },
      })
      return workspace
    })
  }

  async updateById(id: string, data: Prisma.WorkspaceUpdateInput): Promise<Workspace> {
    return this.prisma.workspace.update({ where: { id }, data })
  }

  async softDeleteById(id: string): Promise<Workspace> {
    return this.prisma.workspace.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async addMember(input: {
    workspaceId: string
    userId: string
    role: WorkspaceRole
    invitedBy?: string
  }): Promise<WorkspaceMember> {
    return this.prisma.workspaceMember.create({
      data: {
        workspace: { connect: { id: input.workspaceId } },
        user: { connect: { id: input.userId } },
        role: input.role,
        invitedBy: input.invitedBy,
      },
    })
  }

  async updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<WorkspaceMember> {
    return this.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: { role },
    })
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await this.prisma.workspaceMember.deleteMany({ where: { workspaceId, userId } })
  }
}
