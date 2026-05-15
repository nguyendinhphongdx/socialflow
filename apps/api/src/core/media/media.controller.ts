import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'
import { MediaService } from './media.service'
import {
  ConfirmUploadDto,
  ConfirmUploadDtoSchema,
  CreateUploadUrlDto,
  CreateUploadUrlDtoSchema,
  ListMediaDto,
  ListMediaDtoSchema,
} from './media.dto'
import { MediaListVo, MediaVo, UploadUrlVo } from './media.vo'

@ApiTags('Media')
@ApiBearerAuth()
@Controller('/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @ApiDoc({
    summary: 'Tạo pre-signed upload URL — client PUT trực tiếp lên S3/R2',
    body: CreateUploadUrlDtoSchema,
    response: UploadUrlVo,
  })
  @Post('/upload-url')
  async createUploadUrl(@Body() dto: CreateUploadUrlDto) {
    return this.media.createUploadUrl(dto)
  }

  @ApiDoc({ summary: 'Xác nhận upload xong — mark status=UPLOADED', body: ConfirmUploadDtoSchema, response: MediaVo })
  @Post('/confirm')
  async confirm(@Body() dto: ConfirmUploadDto) {
    const entity = await this.media.confirmUpload(dto.mediaId)
    return MediaVo.create(entity)
  }

  @ApiDoc({ summary: 'Liệt kê media của user', query: ListMediaDtoSchema, response: MediaListVo })
  @Get('/')
  async list(@Query() query: ListMediaDto) {
    const result = await this.media.listByCurrentUser(query, { type: query.type, status: query.status })
    return new MediaListVo({
      list: result.list.map(MediaVo.create),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  }

  @ApiDoc({ summary: 'Chi tiết media', response: MediaVo })
  @Get('/:id')
  async getById(@Param('id') id: string) {
    const entity = await this.media.getByCurrentUserAndId(id)
    return MediaVo.create(entity)
  }

  @ApiDoc({ summary: 'Xoá media (soft delete + xoá object trên storage)' })
  @Delete('/:id')
  async delete(@Param('id') id: string): Promise<{ ok: true }> {
    await this.media.softDelete(id)
    return { ok: true }
  }
}
