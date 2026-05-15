import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Public } from '@sociflow/common'

@ApiTags('Health')
@Controller('/health')
export class HealthController {
  @Public()
  @Get('/')
  check() {
    return { status: 'ok', service: 'ai', timestamp: Date.now(), uptime: process.uptime() }
  }
}
