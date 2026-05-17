import { Module } from '@nestjs/common'
import { INTERNAL_TOKEN_OPTIONS, InternalTokenGuard } from '@sociflow/internal-client'
import { APP_CONFIG, type AppConfig } from '../../config'
import { GenerationController } from './generation.controller'
import { GenerationService } from './generation.service'
import { SentimentController } from './sentiment.controller'
import { SentimentService } from './sentiment.service'

@Module({
  controllers: [GenerationController, SentimentController],
  providers: [
    GenerationService,
    SentimentService,
    InternalTokenGuard,
    {
      provide: INTERNAL_TOKEN_OPTIONS,
      useFactory: (config: AppConfig) => ({ expectedToken: config.internal.token }),
      inject: [APP_CONFIG],
    },
  ],
})
export class GenerationModule {}
