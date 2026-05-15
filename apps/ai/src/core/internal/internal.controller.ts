import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiDoc } from '@sociflow/common'
import { InternalTokenGuard } from '@sociflow/internal-client'

@ApiTags('Internal AI')
@UseGuards(InternalTokenGuard)
@Controller('/internal/ai')
export class InternalAiController {
  @ApiDoc({ summary: 'Echo smoke test endpoint (internal only)' })
  @Post('/echo')
  echo(@Body() body: { message: unknown }) {
    return {
      echo: body?.message ?? null,
      receivedAt: Date.now(),
      service: 'ai',
    }
  }
}
