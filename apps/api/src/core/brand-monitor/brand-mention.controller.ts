import { Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'
import { BrandMonitorService } from './brand-monitor.service'
import { ListBrandMentionDto, ListBrandMentionDtoSchema } from './brand-mention.dto'
import { BrandMentionListVo, BrandMentionVo } from './brand-mention.vo'

@ApiTags('BrandMonitor / Mentions')
@ApiBearerAuth()
@Controller('/brand-mentions')
export class BrandMentionController {
  constructor(private readonly monitor: BrandMonitorService) {}

  @ApiDoc({
    summary: 'Liệt kê brand mention của user',
    query: ListBrandMentionDtoSchema,
    response: BrandMentionListVo,
  })
  @Get('/')
  async list(@Query() query: ListBrandMentionDto) {
    const result = await this.monitor.listMentionsByCurrentUser(query, {
      monitorId: query.monitorId,
      sentiment: query.sentiment,
      status: query.status,
    })
    return new BrandMentionListVo({
      list: result.list.map(BrandMentionVo.create),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  }

  @ApiDoc({ summary: 'Chi tiết brand mention', response: BrandMentionVo })
  @Get('/:id')
  async getById(@Param('id') id: string) {
    const entity = await this.monitor.getMentionByCurrentUserAndId(id)
    return BrandMentionVo.create(entity)
  }

  @ApiDoc({ summary: 'Mark mention đã xem (ACKED)', response: BrandMentionVo })
  @Post('/:id/ack')
  async ack(@Param('id') id: string) {
    const entity = await this.monitor.ackMention(id)
    return BrandMentionVo.create(entity)
  }

  @ApiDoc({ summary: 'Archive mention', response: BrandMentionVo })
  @Post('/:id/archive')
  async archive(@Param('id') id: string) {
    const entity = await this.monitor.archiveMention(id)
    return BrandMentionVo.create(entity)
  }
}
