import { z } from 'zod'
import { createZodDto } from '@sociflow/common'
import type { Workspace, WorkspaceMember } from '@prisma/client'

export const WorkspaceVoSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  isPersonal: z.boolean(),
  ownerId: z.string(),
  role: z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class WorkspaceVo extends createZodDto(WorkspaceVoSchema, 'WorkspaceVo') {
  static create(entity: Workspace, role?: string | null) {
    return WorkspaceVoSchema.parse({
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      isPersonal: entity.isPersonal,
      ownerId: entity.ownerId,
      role: role ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    })
  }
}

export const WorkspaceMemberVoSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  role: z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']),
  email: z.string().nullable(),
  name: z.string().nullable(),
  joinedAt: z.date(),
})

export class WorkspaceMemberVo extends createZodDto(WorkspaceMemberVoSchema, 'WorkspaceMemberVo') {
  static create(entity: WorkspaceMember & { user?: { email: string, name: string | null } | null }) {
    return WorkspaceMemberVoSchema.parse({
      id: entity.id,
      workspaceId: entity.workspaceId,
      userId: entity.userId,
      role: entity.role,
      email: entity.user?.email ?? null,
      name: entity.user?.name ?? null,
      joinedAt: entity.joinedAt,
    })
  }
}
