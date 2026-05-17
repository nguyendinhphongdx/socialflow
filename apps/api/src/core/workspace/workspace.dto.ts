import { z } from 'zod'
import { createZodDto } from '@sociflow/common'

const WORKSPACE_ROLE_VALUES = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'] as const
export const WorkspaceRoleSchema = z.enum(WORKSPACE_ROLE_VALUES)

export const CreateWorkspaceDtoSchema = z.object({
  name: z.string().min(1).max(80).describe('Tên workspace'),
  slug: z.string().min(3).max(60).regex(/^[a-z0-9-]+$/, 'slug chỉ gồm a-z, 0-9, dấu gạch ngang').describe('Slug duy nhất, kebab-case'),
}).strict()
export class CreateWorkspaceDto extends createZodDto(CreateWorkspaceDtoSchema, 'CreateWorkspaceDto') {}

export const UpdateWorkspaceDtoSchema = z.object({
  name: z.string().min(1).max(80).optional().describe('Tên workspace'),
}).strict()
export class UpdateWorkspaceDto extends createZodDto(UpdateWorkspaceDtoSchema, 'UpdateWorkspaceDto') {}

export const InviteMemberDtoSchema = z.object({
  email: z.string().email().max(254).describe('Email của user cần mời'),
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']).default('EDITOR').describe('Role gán cho member (không thể là OWNER)'),
}).strict()
export class InviteMemberDto extends createZodDto(InviteMemberDtoSchema, 'InviteMemberDto') {}

export const UpdateMemberRoleDtoSchema = z.object({
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']).describe('Role mới gán cho member (không thể downgrade owner)'),
}).strict()
export class UpdateMemberRoleDto extends createZodDto(UpdateMemberRoleDtoSchema, 'UpdateMemberRoleDto') {}
