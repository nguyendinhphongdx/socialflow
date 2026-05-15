import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'
import { BrandMonitorService } from './brand-monitor.service'
import {
  CreateBrandMonitorDto,
  CreateBrandMonitorDtoSchema,
  ListBrandMonitorDto,
  ListBrandMonitorDtoSchema,
  UpdateBrandMonitorDto,
  UpdateBrandMonitorDtoSchema,
} from './brand-monitor.dto'
import { BrandMonitorListVo, BrandMonitorPollResultVo, BrandMonitorVo } from './brand-monitor.vo'

@ApiTags('BrandMonitor')
@ApiBearerAuth()
@Controller('/brand-monitors')
export class BrandMonitorController {
  constructor(private readonly monitor: BrandMonitorService) {}

  @ApiDoc({
    summary: 'Liệt kê brand monitor của user',
    query: ListBrandMonitorDtoSchema,
    response: BrandMonitorListVo,
  })
  @Get('/')
  async list(@Query() query: ListBrandMonitorDto) {
    const result = await this.monitor.listByCurrentUser(query, { enabled: query.enabled })
    return new BrandMonitorListVo({
      list: result.list.map(BrandMonitorVo.create),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  }

  @ApiDoc({
    summary: 'Tạo brand monitor mới',
    body: CreateBrandMonitorDtoSchema,
    response: BrandMonitorVo,
  })
  @Post('/')
  async create(@Body() dto: CreateBrandMonitorDto) {
    const entity = await this.monitor.create(dto)
    return BrandMonitorVo.create(entity)
  }

  @ApiDoc({ summary: 'Chi tiết brand monitor', response: BrandMonitorVo })
  @Get('/:id')
  async getById(@Param('id') id: string) {
    const entity = await this.monitor.getByCurrentUserAndId(id)
    return BrandMonitorVo.create(entity)
  }

  @ApiDoc({
    summary: 'Cập nhật brand monitor',
    body: UpdateBrandMonitorDtoSchema,
    response: BrandMonitorVo,
  })
  @Patch('/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateBrandMonitorDto) {
    const entity = await this.monitor.update(id, dto)
    return BrandMonitorVo.create(entity)
  }

  @ApiDoc({ summary: 'Xoá brand monitor (soft delete)' })
  @Delete('/:id')
  async delete(@Param('id') id: string): Promise<{ ok: true }> {
    await this.monitor.softDelete(id)
    return { ok: true }
  }

  @ApiDoc({
    summary: 'Trigger poll ngay lập tức (manual) — bỏ qua schedule interval',
    response: BrandMonitorPollResultVo,
  })
  @Post('/:id/poll-now')
  async pollNow(@Param('id') id: string) {
    const result = await this.monitor.pollByCurrentUser(id)
    return result
  }
}
