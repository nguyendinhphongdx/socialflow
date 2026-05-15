import { Module } from '@nestjs/common'
import { INTERNAL_TOKEN_OPTIONS, InternalTokenGuard } from '@sociflow/internal-client'
import { APP_CONFIG, type AppConfig } from '../../config'
import { InternalAiController } from './internal.controller'

@Module({
  controllers: [InternalAiController],
  providers: [
    InternalTokenGuard,
    {
      provide: INTERNAL_TOKEN_OPTIONS,
      useFactory: (config: AppConfig) => ({ expectedToken: config.internal.token }),
      inject: [APP_CONFIG],
    },
  ],
})
export class InternalAiModule {}
