import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'
import { DraftService } from './draft.service'
import {
  CreateDraftDto,
  CreateDraftDtoSchema,
  ListDraftDto,
  ListDraftDtoSchema,
  PublishDraftDto,
  PublishDraftDtoSchema,
  UpdateDraftDto,
  UpdateDraftDtoSchema,
} from './draft.dto'
import { DraftListVo, DraftPublishResultVo, DraftVo } from './draft.vo'

@ApiTags('Draft')
@ApiBearerAuth()
@Controller('/drafts')
export class DraftController {
  constructor(private readonly draft: DraftService) {}

  @ApiDoc({
    summary: 'Liệt kê bản nháp của user',
    query: ListDraftDtoSchema,
    response: DraftListVo,
  })
  @Get('/')
  async list(@Query() query: ListDraftDto) {
    const result = await this.draft.listByCurrentUser(query, { tag: query.tag })
    return new DraftListVo({
      list: result.list.map(DraftVo.create),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  }

  @ApiDoc({
    summary: 'Tạo bản nháp mới',
    body: CreateDraftDtoSchema,
    response: DraftVo,
  })
  @Post('/')
  async create(@Body() dto: CreateDraftDto) {
    const entity = await this.draft.create(dto)
    return DraftVo.create(entity)
  }

  @ApiDoc({ summary: 'Chi tiết bản nháp', response: DraftVo })
  @Get('/:id')
  async getById(@Param('id') id: string) {
    const entity = await this.draft.getByCurrentUserAndId(id)
    return DraftVo.create(entity)
  }

  @ApiDoc({
    summary: 'Cập nhật bản nháp',
    body: UpdateDraftDtoSchema,
    response: DraftVo,
  })
  @Patch('/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateDraftDto) {
    const entity = await this.draft.update(id, dto)
    return DraftVo.create(entity)
  }

  @ApiDoc({ summary: 'Xoá bản nháp (soft delete)' })
  @Delete('/:id')
  async delete(@Param('id') id: string): Promise<{ ok: true }> {
    await this.draft.softDelete(id)
    return { ok: true }
  }

  @ApiDoc({
    summary: 'Publish bản nháp — convert sang PublishRecord và soft delete draft',
    body: PublishDraftDtoSchema,
    response: [DraftPublishResultVo],
  })
  @Post('/:id/publish')
  async publish(@Param('id') id: string, @Body() dto: PublishDraftDto) {
    const records = await this.draft.publishDraft(id, dto)
    return records.map(DraftPublishResultVo.create)
  }
}
