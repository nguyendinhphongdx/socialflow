import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'
import { AutoReplyRuleService } from './auto-reply-rule.service'
import {
  CreateAutoReplyRuleDto,
  CreateAutoReplyRuleDtoSchema,
  ListAutoReplyRuleDto,
  ListAutoReplyRuleDtoSchema,
  UpdateAutoReplyRuleDto,
  UpdateAutoReplyRuleDtoSchema,
} from './auto-reply.dto'
import { AutoReplyRuleListVo, AutoReplyRuleVo } from './auto-reply.vo'

@ApiTags('AutoReplyRule')
@ApiBearerAuth()
@Controller('/auto-reply-rules')
export class AutoReplyRuleController {
  constructor(private readonly service: AutoReplyRuleService) {}

  @ApiDoc({
    summary: 'Liệt kê rule auto-reply của user',
    query: ListAutoReplyRuleDtoSchema,
    response: AutoReplyRuleListVo,
  })
  @Get('/')
  async list(@Query() query: ListAutoReplyRuleDto) {
    const result = await this.service.listByCurrentUser(query)
    return new AutoReplyRuleListVo({
      list: result.list.map(AutoReplyRuleVo.create),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  }

  @ApiDoc({
    summary: 'Tạo rule auto-reply',
    body: CreateAutoReplyRuleDtoSchema,
    response: AutoReplyRuleVo,
  })
  @Post('/')
  async create(@Body() dto: CreateAutoReplyRuleDto) {
    const entity = await this.service.create(dto)
    return AutoReplyRuleVo.create(entity)
  }

  @ApiDoc({ summary: 'Chi tiết rule', response: AutoReplyRuleVo })
  @Get('/:id')
  async getById(@Param('id') id: string) {
    const entity = await this.service.getByCurrentUserAndId(id)
    return AutoReplyRuleVo.create(entity)
  }

  @ApiDoc({
    summary: 'Cập nhật rule',
    body: UpdateAutoReplyRuleDtoSchema,
    response: AutoReplyRuleVo,
  })
  @Patch('/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateAutoReplyRuleDto) {
    const entity = await this.service.update(id, dto)
    return AutoReplyRuleVo.create(entity)
  }

  @ApiDoc({ summary: 'Xoá rule (soft delete)' })
  @Delete('/:id')
  async delete(@Param('id') id: string): Promise<{ ok: true }> {
    await this.service.softDelete(id)
    return { ok: true }
  }

  @ApiDoc({
    summary: 'Toggle bật / tắt rule',
    response: AutoReplyRuleVo,
  })
  @Post('/:id/toggle')
  async toggle(@Param('id') id: string) {
    const entity = await this.service.toggleEnabled(id)
    return AutoReplyRuleVo.create(entity)
  }
}
