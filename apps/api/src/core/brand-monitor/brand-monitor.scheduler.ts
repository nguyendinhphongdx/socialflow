import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { BrandMonitorService } from './brand-monitor.service'

/**
 * Cron mỗi 10 phút: quét brand monitor đến hạn poll → trigger search per platform.
 * Service.pollAll xử lý error per-monitor nên không cần wrap try-catch ở đây.
 */
@Injectable()
export class BrandMonitorScheduler {
  private readonly logger = new Logger(BrandMonitorScheduler.name)

  constructor(private readonly service: BrandMonitorService) {}

  @Cron('*/10 * * * *', { name: 'brand-monitor-poll' })
  async pollDue(): Promise<void> {
    const result = await this.service.pollAll()
    if (result.polled > 0) {
      this.logger.log(`brand-monitor cron polled=${result.polled} matches=${result.totalMatches}`)
    }
  }
}
