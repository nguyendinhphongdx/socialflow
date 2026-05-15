import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus'
import { Public } from '@sociflow/common'
import { PrismaService } from '@sociflow/prisma'

@ApiTags('Health')
@Controller('/health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @HealthCheck()
  @Get('/')
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ])
  }

  @Public()
  @Get('/live')
  live() {
    return { status: 'ok', timestamp: Date.now(), uptime: process.uptime() }
  }
}
