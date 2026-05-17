import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'
import { CommentService } from './comment.service'
import {
  BulkActionDto,
  BulkActionDtoSchema,
  BulkReplyDto,
  BulkReplyDtoSchema,
  ListCommentDto,
  ListCommentDtoSchema,
  MarkCommentDto,
  MarkCommentDtoSchema,
  ReplyCommentDto,
  ReplyCommentDtoSchema,
} from './comment.dto'
import { BulkActionResultVo, CommentListVo, CommentVo } from './comment.vo'

@ApiTags('Comment')
@ApiBearerAuth()
@Controller('/comments')
export class CommentController {
  constructor(private readonly service: CommentService) {}

  @ApiDoc({
    summary: 'Inbox comment — list paginated với filter',
    query: ListCommentDtoSchema,
    response: CommentListVo,
  })
  @Get('/')
  async list(@Query() query: ListCommentDto) {
    const result = await this.service.listByCurrentUser(query, {
      status: query.status,
      accountId: query.accountId,
      platform: query.platform,
      publishRecordId: query.publishRecordId,
      hasReply: query.hasReply,
      search: query.search,
    })
    return new CommentListVo({
      list: result.list.map(CommentVo.create),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  }

  @ApiDoc({ summary: 'Chi tiết comment', response: CommentVo })
  @Get('/:id')
  async getById(@Param('id') id: string) {
    const comment = await this.service.getByCurrentUserAndId(id)
    return CommentVo.create(comment)
  }

  @ApiDoc({
    summary: 'Reply comment manual',
    body: ReplyCommentDtoSchema,
    response: CommentVo,
  })
  @Post('/:id/reply')
  async reply(@Param('id') id: string, @Body() dto: ReplyCommentDto) {
    const comment = await this.service.replyManualFromCurrentUser(id, dto.text)
    return CommentVo.create(comment)
  }

  @ApiDoc({
    summary: 'Đánh dấu comment (read / ignore / spam)',
    body: MarkCommentDtoSchema,
    response: CommentVo,
  })
  @Post('/:id/mark')
  async mark(@Param('id') id: string, @Body() dto: MarkCommentDto) {
    const comment = await this.service.applyMarkAction(id, dto.action)
    return CommentVo.create(comment)
  }

  @ApiDoc({ summary: 'Xoá comment khỏi inbox (soft delete, không xoá platform)' })
  @Delete('/:id')
  async delete(@Param('id') id: string): Promise<{ ok: true }> {
    await this.service.softDelete(id)
    return { ok: true }
  }

  @ApiDoc({
    summary: 'Bulk reply nhiều comment cùng nội dung',
    body: BulkReplyDtoSchema,
    response: BulkActionResultVo,
  })
  @Post('/bulk/reply')
  async bulkReply(@Body() dto: BulkReplyDto) {
    const { total, failures } = await this.service.bulkReply(dto.commentIds, dto.replyText)
    return BulkActionResultVo.build(total, failures)
  }

  @ApiDoc({
    summary: 'Bulk mark replied',
    body: BulkActionDtoSchema,
    response: BulkActionResultVo,
  })
  @Post('/bulk/mark-replied')
  async bulkMarkReplied(@Body() dto: BulkActionDto) {
    const { total, failures } = await this.service.bulkMarkReplied(dto.commentIds)
    return BulkActionResultVo.build(total, failures)
  }

  @ApiDoc({
    summary: 'Bulk archive (ignore) comment',
    body: BulkActionDtoSchema,
    response: BulkActionResultVo,
  })
  @Post('/bulk/archive')
  async bulkArchive(@Body() dto: BulkActionDto) {
    const { total, failures } = await this.service.bulkArchive(dto.commentIds)
    return BulkActionResultVo.build(total, failures)
  }

  @ApiDoc({
    summary: 'Bulk soft delete comment',
    body: BulkActionDtoSchema,
    response: BulkActionResultVo,
  })
  @Post('/bulk/delete')
  async bulkDelete(@Body() dto: BulkActionDto) {
    const { total, failures } = await this.service.bulkSoftDelete(dto.commentIds)
    return BulkActionResultVo.build(total, failures)
  }
}
