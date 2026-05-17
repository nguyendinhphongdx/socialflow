import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc, Public } from '@sociflow/common'
import { ApiKeyAuthGuard } from '../api-key/api-key-auth.guard'
import { ApiKeyScope } from '../api-key/api-key.constants'
import { RequireScopes } from '../api-key/require-scopes.decorator'
import { PublishService } from './publish.service'
import {
  CreatePublishDto,
  CreatePublishDtoSchema,
  ListPublishDto,
  ListPublishDtoSchema,
} from './publish.dto'
import { PublishRecordListVo, PublishRecordVo } from './publish.vo'

/**
 * Publish endpoint nhận cả JWT (web session) và X-API-Key (3rd-party integration).
 *
 * Pattern:
 *  - `@Public()` ở class-level để bypass global `JwtAuthGuard` — `ApiKeyAuthGuard`
 *    sẽ tự handle JWT khi không có API key.
 *  - `@RequireScopes(...)` ở từng method để gate scope khi authed bằng API key.
 *    JWT user (web) có full scope → bỏ qua check.
 */
@ApiTags('Publish')
@ApiBearerAuth()
@Public()
@UseGuards(ApiKeyAuthGuard)
@Controller('/publish')
export class PublishController {
  constructor(private readonly service: PublishService) {}

  @ApiDoc({
    summary: 'Tạo publish bundle (multi-account)',
    body: CreatePublishDtoSchema,
    response: PublishRecordListVo,
  })
  @RequireScopes(ApiKeyScope.PUBLISH_WRITE)
  @Post('/')
  async create(@Body() dto: CreatePublishDto) {
    const records = await this.service.createBundle(dto)
    const flowId = records[0]!.flowId ?? records[0]!.id
    const result = await this.service.listBundleByFlowId(flowId)
    return new PublishRecordListVo({
      list: result.list.map(PublishRecordVo.create),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  }

  @ApiDoc({
    summary: 'Liệt kê publish records',
    query: ListPublishDtoSchema,
    response: PublishRecordListVo,
  })
  @RequireScopes(ApiKeyScope.PUBLISH_READ)
  @Get('/')
  async list(@Query() query: ListPublishDto) {
    const result = await this.service.listByCurrentUser(query, {
      status: query.status,
      accountId: query.accountId,
      flowId: query.flowId,
    })
    return new PublishRecordListVo({
      list: result.list.map(PublishRecordVo.create),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  }

  @ApiDoc({ summary: 'Chi tiết publish record', response: PublishRecordVo })
  @RequireScopes(ApiKeyScope.PUBLISH_READ)
  @Get('/:id')
  async getById(@Param('id') id: string) {
    const record = await this.service.getByCurrentUserAndId(id)
    return PublishRecordVo.create(record)
  }

  @ApiDoc({ summary: 'Cancel publish (chỉ khi chưa PUBLISHED)' })
  @RequireScopes(ApiKeyScope.PUBLISH_WRITE)
  @Delete('/:id')
  async cancel(@Param('id') id: string): Promise<{ ok: true }> {
    await this.service.cancel(id)
    return { ok: true }
  }
}
