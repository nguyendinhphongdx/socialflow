import { Module } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import { ContextModule } from '@sociflow/auth'
import { AppConfigModule } from './config'
import { GenerationModule } from './core/generation/generation.module'
import { HealthModule } from './core/health/health.module'
import { InternalAiModule } from './core/internal/internal.module'
import { ProvidersModule } from './core/providers/providers.module'

@Module({
  imports: [
    AppConfigModule,
    ContextModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
      },
    }),
    ProvidersModule,
    HealthModule,
    InternalAiModule,
    GenerationModule,
  ],
})
export class AppModule {}
