import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'
import { RequireWorkspaceRole } from '@sociflow/auth'
import { AiCredentialService } from './ai-credential.service'
import {
  CreateAiCredentialDto,
  CreateAiCredentialDtoSchema,
  UpdateAiCredentialDto,
  UpdateAiCredentialDtoSchema,
} from './credential.dto'
import {
  AiCredentialStatusVo,
  AiCredentialVo,
  OAuthVerifyVo,
} from './credential.vo'

@ApiTags('AI Credentials (BYOK)')
@ApiBearerAuth()
@Controller('/ai-credentials')
export class AiCredentialController {
  constructor(private readonly service: AiCredentialService) {}

  @ApiDoc({
    summary: 'Liệt kê AI credentials của workspace hiện tại',
    response: [AiCredentialVo],
  })
  @Get('/')
  async list(): Promise<AiCredentialVo[]> {
    const entities = await this.service.listForCurrentWorkspace()
    return entities.map((e) => AiCredentialVo.create({
      ...e,
      apiKeyMasked: this.service.decryptAndMask(e),
    }))
  }

  @ApiDoc({
    summary: 'Bảng status credential per provider',
    response: AiCredentialStatusVo,
  })
  @Get('/status')
  async status(): Promise<AiCredentialStatusVo> {
    const rows = await this.service.getStatusForCurrentWorkspace()
    return new AiCredentialStatusVo({ rows })
  }

  @ApiDoc({
    summary: 'Tạo / cập nhật workspace AI credential',
    body: CreateAiCredentialDtoSchema,
    response: AiCredentialVo,
  })
  @RequireWorkspaceRole('ADMIN')
  @Post('/')
  async create(@Body() dto: CreateAiCredentialDto): Promise<AiCredentialVo> {
    const entity = await this.service.createOrUpsert(dto)
    return AiCredentialVo.create({ ...entity, apiKeyMasked: this.service.decryptAndMask(entity) })
  }

  @ApiDoc({
    summary: 'Cập nhật AI credential',
    body: UpdateAiCredentialDtoSchema,
    response: AiCredentialVo,
  })
  @RequireWorkspaceRole('ADMIN')
  @Patch('/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAiCredentialDto,
  ): Promise<AiCredentialVo> {
    const entity = await this.service.updateById(id, dto)
    return AiCredentialVo.create({ ...entity, apiKeyMasked: this.service.decryptAndMask(entity) })
  }

  @ApiDoc({ summary: 'Revoke workspace AI credential' })
  @RequireWorkspaceRole('ADMIN')
  @Delete('/:id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string): Promise<{ ok: true }> {
    await this.service.deleteById(id)
    return { ok: true }
  }

  @ApiDoc({
    summary: 'Verify AI credential (sanity decrypt)',
    response: OAuthVerifyVo,
  })
  @RequireWorkspaceRole('ADMIN')
  @Post('/:id/verify')
  async verify(@Param('id') id: string): Promise<OAuthVerifyVo> {
    const result = await this.service.verify(id)
    return new OAuthVerifyVo(result)
  }
}
