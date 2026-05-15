import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'
import { PublishService } from './publish.service'
import {
  CreatePublishDto,
  CreatePublishDtoSchema,
  ListPublishDto,
  ListPublishDtoSchema,
} from './publish.dto'
import { PublishRecordListVo, PublishRecordVo } from './publish.vo'
import { PublishRepository } from './publish.repository'

@ApiTags('Publish')
@ApiBearerAuth()
@Controller('/publish')
export class PublishController {
  constructor(
    private readonly service: PublishService,
    private readonly repo: PublishRepository,
  ) {}

  @ApiDoc({
    summary: 'Tạo publish bundle (multi-account)',
    body: CreatePublishDtoSchema,
    response: PublishRecordListVo,
  })
  @Post('/')
  async create(@Body() dto: CreatePublishDto) {
    const records = await this.service.createBundle(dto)
    // Re-fetch với account để map VO
    const userId = records[0]!.userId
    const flowId = records[0]!.flowId ?? records[0]!.id
    const result = await this.repo.listByUserWithPagination(userId, { page: 1, pageSize: 50 }, { flowId })
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
  @Get('/:id')
  async getById(@Param('id') id: string) {
    const record = await this.service.getByCurrentUserAndId(id)
    return PublishRecordVo.create(record)
  }

  @ApiDoc({ summary: 'Cancel publish (chỉ khi chưa PUBLISHED)' })
  @Delete('/:id')
  async cancel(@Param('id') id: string): Promise<{ ok: true }> {
    await this.service.cancel(id)
    return { ok: true }
  }
}
