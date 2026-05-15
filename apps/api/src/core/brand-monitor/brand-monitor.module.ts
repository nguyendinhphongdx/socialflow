import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { BrandMonitorController } from './brand-monitor.controller'
import { BrandMonitorRepository } from './brand-monitor.repository'
import { BrandMonitorScheduler } from './brand-monitor.scheduler'
import { BrandMonitorService } from './brand-monitor.service'

@Module({
  imports: [AuthModule],
  controllers: [BrandMonitorController],
  providers: [
    BrandMonitorService,
    BrandMonitorRepository,
    BrandMonitorScheduler,
  ],
  exports: [BrandMonitorService],
})
export class BrandMonitorModule {}
