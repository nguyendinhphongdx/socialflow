import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'
import { ApiKeyService } from './api-key.service'
import {
  CreateApiKeyDto,
  CreateApiKeyDtoSchema,
  ListApiKeysDto,
  ListApiKeysDtoSchema,
} from './api-key.dto'
import { ApiKeyCreatedVo, ApiKeyListVo, ApiKeyVo } from './api-key.vo'

@ApiTags('API Key')
@ApiBearerAuth()
@Controller('/api-keys')
export class ApiKeyController {
  constructor(private readonly apiKey: ApiKeyService) {}

  @ApiDoc({
    summary: 'Liệt kê API key của user',
    query: ListApiKeysDtoSchema,
    response: ApiKeyListVo,
  })
  @Get('/')
  async list(@Query() query: ListApiKeysDto) {
    const result = await this.apiKey.listByCurrentUser(query, { includeRevoked: query.includeRevoked })
    return new ApiKeyListVo({
      list: result.list.map(ApiKeyVo.create),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  }

  @ApiDoc({
    summary: 'Tạo API key mới — raw key chỉ hiển thị 1 lần trong response',
    body: CreateApiKeyDtoSchema,
    response: ApiKeyCreatedVo,
  })
  @Post('/')
  async create(@Body() dto: CreateApiKeyDto) {
    const { entity, rawKey } = await this.apiKey.create({
      name: dto.name,
      scopes: dto.scopes,
      expiresAt: dto.expiresAt,
    })
    return ApiKeyCreatedVo.fromEntity(entity, rawKey)
  }

  @ApiDoc({ summary: 'Chi tiết API key (metadata, không trả raw key)', response: ApiKeyVo })
  @Get('/:id')
  async getById(@Param('id') id: string) {
    const entity = await this.apiKey.getByCurrentUserAndId(id)
    return ApiKeyVo.create(entity)
  }

  @ApiDoc({ summary: 'Revoke API key (immediate, vĩnh viễn)' })
  @Delete('/:id')
  @HttpCode(HttpStatus.OK)
  async revoke(@Param('id') id: string): Promise<{ ok: true }> {
    await this.apiKey.revoke(id)
    return { ok: true }
  }
}
