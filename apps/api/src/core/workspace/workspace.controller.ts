import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc, CurrentUser, type AuthUser } from '@sociflow/common'
import { WorkspaceService } from './workspace.service'
import {
  CreateWorkspaceDto,
  CreateWorkspaceDtoSchema,
  InviteMemberDto,
  InviteMemberDtoSchema,
  UpdateMemberRoleDto,
  UpdateMemberRoleDtoSchema,
  UpdateWorkspaceDto,
  UpdateWorkspaceDtoSchema,
} from './workspace.dto'
import { WorkspaceMemberVo, WorkspaceVo } from './workspace.vo'

@ApiTags('Workspace')
@ApiBearerAuth()
@Controller('/workspaces')
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @ApiDoc({ summary: 'Liệt kê workspace user là member', response: [WorkspaceVo] })
  @Get('/')
  async list() {
    const memberships = await this.workspace.listMembershipsForCurrentUser()
    return memberships.map(m => WorkspaceVo.create(m.workspace, m.role))
  }

  @ApiDoc({ summary: 'Lấy workspace hiện tại (từ context)', response: WorkspaceVo })
  @Get('/current')
  async current(@CurrentUser() _user: AuthUser) {
    const { workspace, role } = await this.workspace.getCurrentWorkspace()
    return WorkspaceVo.create(workspace, role)
  }

  @ApiDoc({
    summary: 'Tạo team workspace mới (không personal)',
    body: CreateWorkspaceDtoSchema,
    response: WorkspaceVo,
  })
  @Post('/')
  async create(@Body() dto: CreateWorkspaceDto) {
    const workspace = await this.workspace.createTeamWorkspace(dto)
    return WorkspaceVo.create(workspace, 'OWNER')
  }

  @ApiDoc({
    summary: 'Cập nhật workspace (cần role ADMIN trở lên)',
    body: UpdateWorkspaceDtoSchema,
    response: WorkspaceVo,
  })
  @Patch('/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateWorkspaceDto) {
    const workspace = await this.workspace.updateById(id, dto)
    return WorkspaceVo.create(workspace, null)
  }

  @ApiDoc({ summary: 'Xoá workspace (chỉ OWNER, không cho phép personal)' })
  @Delete('/:id')
  async delete(@Param('id') id: string): Promise<{ ok: true }> {
    await this.workspace.softDeleteById(id)
    return { ok: true }
  }

  @ApiDoc({ summary: 'Liệt kê member của workspace', response: [WorkspaceMemberVo] })
  @Get('/:id/members')
  async listMembers(@Param('id') workspaceId: string) {
    const members = await this.workspace.listMembers(workspaceId)
    return members.map(WorkspaceMemberVo.create)
  }

  @ApiDoc({
    summary: 'Mời member mới vào workspace (cần role ADMIN trở lên)',
    body: InviteMemberDtoSchema,
    response: WorkspaceMemberVo,
  })
  @Post('/:id/invite')
  async invite(@Param('id') workspaceId: string, @Body() dto: InviteMemberDto) {
    const member = await this.workspace.inviteMember(workspaceId, dto)
    return WorkspaceMemberVo.create(member)
  }

  @ApiDoc({
    summary: 'Cập nhật role của member (không thể downgrade OWNER)',
    body: UpdateMemberRoleDtoSchema,
    response: WorkspaceMemberVo,
  })
  @Patch('/:id/members/:userId/role')
  async updateRole(
    @Param('id') workspaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const member = await this.workspace.updateMemberRole(workspaceId, userId, dto)
    return WorkspaceMemberVo.create(member)
  }

  @ApiDoc({ summary: 'Xoá member khỏi workspace (cần role ADMIN trở lên)' })
  @Delete('/:id/members/:userId')
  async removeMember(@Param('id') workspaceId: string, @Param('userId') userId: string): Promise<{ ok: true }> {
    await this.workspace.removeMember(workspaceId, userId)
    return { ok: true }
  }
}
