import { Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'
import { InsightService } from './insight.service'
import {
  AccountTimelineQueryDto,
  AccountTimelineQueryDtoSchema,
} from './insight.dto'
import {
  AccountTimelinePointVo,
  AccountTimelineVo,
  PostInsightListVo,
  PostInsightVo,
} from './insight.vo'

@ApiTags('Insight')
@ApiBearerAuth()
@Controller('/insights')
export class InsightController {
  constructor(private readonly insight: InsightService) {}

  @ApiDoc({
    summary: 'List snapshots của 1 publish record (lịch sử metric per polling)',
    response: PostInsightListVo,
  })
  @Get('/posts/:publishRecordId')
  async listPostSnapshots(@Param('publishRecordId') publishRecordId: string) {
    const list = await this.insight.listPostSnapshotsByCurrentUser(publishRecordId)
    return new PostInsightListVo({
      list: list.map(PostInsightVo.create),
      total: list.length,
    })
  }

  @ApiDoc({
    summary: 'Snapshot mới nhất của 1 publish record',
    response: PostInsightVo,
  })
  @Get('/posts/:publishRecordId/latest')
  async latestPostSnapshot(@Param('publishRecordId') publishRecordId: string) {
    const entity = await this.insight.latestPostSnapshotByCurrentUser(publishRecordId)
    return PostInsightVo.create(entity)
  }

  @ApiDoc({
    summary: 'Trigger snapshot ngay lập tức cho 1 publish record (manual)',
    response: PostInsightVo,
  })
  @Post('/posts/:publishRecordId/snapshot-now')
  async snapshotNow(@Param('publishRecordId') publishRecordId: string) {
    const entity = await this.insight.snapshotPostByCurrentUser(publishRecordId)
    return PostInsightVo.create(entity)
  }

  @ApiDoc({
    summary: 'Timeline daily insight của account (N ngày gần nhất)',
    query: AccountTimelineQueryDtoSchema,
    response: AccountTimelineVo,
  })
  @Get('/accounts/:accountId/timeline')
  async accountTimeline(
    @Param('accountId') accountId: string,
    @Query() query: AccountTimelineQueryDto,
  ) {
    const points = await this.insight.listAccountTimelineByCurrentUser(accountId, query.days)
    return new AccountTimelineVo({
      list: points.map(AccountTimelinePointVo.create),
      accountId,
      days: query.days,
    })
  }
}
