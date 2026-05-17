import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'
import { RequireWorkspaceRole } from '@sociflow/auth'
import { OAuthCredentialService } from './oauth-credential.service'
import {
  CreateOAuthCredentialDto,
  CreateOAuthCredentialDtoSchema,
  UpdateOAuthCredentialDto,
  UpdateOAuthCredentialDtoSchema,
} from './credential.dto'
import {
  OAuthCredentialStatusVo,
  OAuthCredentialVo,
  OAuthVerifyVo,
} from './credential.vo'

@ApiTags('OAuth Credentials (BYOK)')
@ApiBearerAuth()
@Controller('/oauth-credentials')
export class OAuthCredentialController {
  constructor(private readonly service: OAuthCredentialService) {}

  @ApiDoc({
    summary: 'Liệt kê OAuth credentials của workspace hiện tại',
    response: [OAuthCredentialVo],
  })
  @Get('/')
  async list(): Promise<OAuthCredentialVo[]> {
    const entities = await this.service.listForCurrentWorkspace()
    return entities.map((e) => {
      const vo = OAuthCredentialVo.create(e)
      vo.clientSecretMasked = this.service.decryptAndMask(e)
      return vo
    })
  }

  @ApiDoc({
    summary: 'Bảng status credential per platform (WORKSPACE | SYSTEM | ENV | NONE)',
    response: OAuthCredentialStatusVo,
  })
  @Get('/status')
  async status(): Promise<OAuthCredentialStatusVo> {
    const rows = await this.service.getStatusForCurrentWorkspace()
    return new OAuthCredentialStatusVo({ rows })
  }

  @ApiDoc({
    summary: 'Tạo / cập nhật workspace credential (upsert theo platform)',
    body: CreateOAuthCredentialDtoSchema,
    response: OAuthCredentialVo,
  })
  @RequireWorkspaceRole('ADMIN')
  @Post('/')
  async create(@Body() dto: CreateOAuthCredentialDto): Promise<OAuthCredentialVo> {
    const entity = await this.service.createOrUpsert(dto)
    const vo = OAuthCredentialVo.create(entity)
    vo.clientSecretMasked = this.service.decryptAndMask(entity)
    return vo
  }

  @ApiDoc({
    summary: 'Cập nhật một phần credential',
    body: UpdateOAuthCredentialDtoSchema,
    response: OAuthCredentialVo,
  })
  @RequireWorkspaceRole('ADMIN')
  @Patch('/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOAuthCredentialDto,
  ): Promise<OAuthCredentialVo> {
    const entity = await this.service.updateById(id, dto)
    const vo = OAuthCredentialVo.create(entity)
    vo.clientSecretMasked = this.service.decryptAndMask(entity)
    return vo
  }

  @ApiDoc({
    summary: 'Revoke workspace credential — fallback về SYSTEM/ENV',
  })
  @RequireWorkspaceRole('ADMIN')
  @Delete('/:id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string): Promise<{ ok: true }> {
    await this.service.deleteById(id)
    return { ok: true }
  }

  @ApiDoc({
    summary: 'Verify credential — dry-run decrypt + URL parse',
    response: OAuthVerifyVo,
  })
  @RequireWorkspaceRole('ADMIN')
  @Post('/:id/verify')
  async verify(@Param('id') id: string): Promise<OAuthVerifyVo> {
    const result = await this.service.verify(id)
    return new OAuthVerifyVo(result)
  }
}
