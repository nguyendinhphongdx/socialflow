import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc, Public } from '@sociflow/common'
import { AgentService } from './agent.service'
import {
  ListAgentsDto,
  ListAgentsDtoSchema,
  PairClaimDto,
  PairClaimDtoSchema,
} from './agent.dto'
import { AgentListVo, AgentVo, PairClaimVo, PairInitVo } from './agent.vo'

@ApiTags('Agent')
@ApiBearerAuth()
@Controller('/agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @ApiDoc({
    summary: 'Khởi tạo pair flow — generate 6-digit code TTL 5 phút',
    response: PairInitVo,
  })
  @Post('/pair/init')
  async initPair() {
    const result = await this.agentService.initPair()
    return PairInitVo.create(result)
  }

  @Public()
  @ApiDoc({
    summary: 'Extension claim pair code — issue agentToken (JWT long-lived)',
    body: PairClaimDtoSchema,
    response: PairClaimVo,
  })
  @Post('/pair/claim')
  async claimPair(@Body() dto: PairClaimDto) {
    const result = await this.agentService.claim(dto)
    return PairClaimVo.create(result)
  }

  @ApiDoc({
    summary: 'Liệt kê agent đã pair của user hiện tại',
    query: ListAgentsDtoSchema,
    response: AgentListVo,
  })
  @Get('/')
  async list(@Query() query: ListAgentsDto) {
    const result = await this.agentService.listByCurrentUser(query, {
      online: query.online,
      includeRevoked: query.includeRevoked,
    })
    return new AgentListVo({
      list: result.list.map(AgentVo.create),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  }

  @ApiDoc({ summary: 'Chi tiết 1 agent', response: AgentVo })
  @Get('/:id')
  async getById(@Param('id') id: string) {
    const agent = await this.agentService.getByCurrentUserAndId(id)
    return AgentVo.create(agent)
  }

  @ApiDoc({ summary: 'Revoke agent — invalidate agentToken + đánh dấu offline', response: AgentVo })
  @Post('/:id/revoke')
  async revoke(@Param('id') id: string) {
    const agent = await this.agentService.revoke(id)
    return AgentVo.create(agent)
  }
}
