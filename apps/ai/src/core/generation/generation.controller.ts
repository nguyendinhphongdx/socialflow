import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'
import { InternalTokenGuard } from '@sociflow/internal-client'
import {
  GenerateCaptionDto,
  GenerateCaptionDtoSchema,
  GenerateCaptionVo,
  GenerateImageDto,
  GenerateImageDtoSchema,
  GenerateImageVo,
} from './generation.dto'
import { GenerationService } from './generation.service'

/**
 * Internal AI generation endpoints. apps/ai không có user JWT guard;
 * chỉ verify `X-Internal-Token` qua `InternalTokenGuard` (shared secret).
 *
 * apps/api gọi qua `@sociflow/internal-client` `AiClientService`.
 */
@ApiTags('Internal AI / Generation')
@UseGuards(InternalTokenGuard)
@Controller('/internal/ai')
export class GenerationController {
  constructor(private readonly generation: GenerationService) {}

  @ApiDoc({
    summary: 'Generate social caption',
    description: 'Sinh caption + hashtags theo platform/tone. Không trừ credit ở đây — apps/api làm.',
    body: GenerateCaptionDtoSchema,
    response: GenerateCaptionVo,
  })
  @Post('/caption')
  async caption(@Body() dto: GenerateCaptionDto): Promise<GenerateCaptionVo> {
    const result = await this.generation.generateCaption(dto)
    return new GenerateCaptionVo({
      caption: result.caption,
      hashtags: result.hashtags,
      model: result.model,
      tokensUsed: result.tokensUsed,
    })
  }

  @ApiDoc({
    summary: 'Generate image (DALL-E 3)',
    description: 'Sinh ảnh từ prompt. Trả về URL host bởi provider (caller phải re-host nếu cần persistent).',
    body: GenerateImageDtoSchema,
    response: GenerateImageVo,
  })
  @Post('/image')
  async image(@Body() dto: GenerateImageDto): Promise<GenerateImageVo> {
    const result = await this.generation.generateImage(dto)
    return new GenerateImageVo({
      imageUrl: result.imageUrl,
      revisedPrompt: result.revisedPrompt,
      model: result.model,
    })
  }
}
