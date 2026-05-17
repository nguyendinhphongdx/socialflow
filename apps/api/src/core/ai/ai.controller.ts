import { Body, Controller, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { ApiDoc } from '@sociflow/common'
import { AiService } from './ai.service'
import { GenerateCaptionDto, GenerateCaptionDtoSchema } from './ai.dto'
import { GenerateCaptionVo } from './ai.vo'

@ApiTags('AI')
@ApiBearerAuth()
@Controller('/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @ApiDoc({
    summary: 'Sinh caption + hashtag cho bài đăng',
    description: 'Proxy sang apps/ai. Trừ 1 AI credit cho mỗi lần gọi thành công.',
    body: GenerateCaptionDtoSchema,
    response: GenerateCaptionVo,
  })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('/caption')
  async caption(@Body() dto: GenerateCaptionDto) {
    const result = await this.ai.generateCaption(dto)
    return GenerateCaptionVo.create(result)
  }
}
