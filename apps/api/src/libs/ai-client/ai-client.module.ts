import { Global, Inject, Module } from '@nestjs/common'
import {
  AI_CLIENT_OPTIONS,
  AiClientService,
} from '@sociflow/internal-client'
import { APP_CONFIG, type AppConfig } from '../../config'

@Global()
@Module({
  providers: [
    AiClientService,
    {
      provide: AI_CLIENT_OPTIONS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        baseUrl: `http://127.0.0.1:${process.env.AI_PORT ?? 3001}/api/v1`,
        internalToken: config.internal.token,
      }),
    },
  ],
  exports: [AiClientService],
})
export class AiClientModule {}
