import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'
import { InternalTokenGuard } from '@sociflow/internal-client'
import {
  ClassifySentimentDto,
  ClassifySentimentDtoSchema,
  ClassifySentimentVo,
} from './sentiment.dto'
import { SentimentService } from './sentiment.service'

/**
 * Internal sentiment endpoint — apps/api gọi qua `AiClientService.classifySentiment`.
 */
@ApiTags('Internal AI / Sentiment')
@UseGuards(InternalTokenGuard)
@Controller('/internal/ai')
export class SentimentController {
  constructor(private readonly sentiment: SentimentService) {}

  @ApiDoc({
    summary: 'Classify sentiment',
    description: 'Phân loại text thành POSITIVE/NEGATIVE/NEUTRAL + confidence score.',
    body: ClassifySentimentDtoSchema,
    response: ClassifySentimentVo,
  })
  @Post('/sentiment')
  async classify(@Body() dto: ClassifySentimentDto): Promise<ClassifySentimentVo> {
    const result = await this.sentiment.classify(dto)
    return new ClassifySentimentVo({
      sentiment: result.sentiment,
      score: result.score,
      model: result.model,
    })
  }
}
