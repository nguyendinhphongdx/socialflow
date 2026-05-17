import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'
import { ContextModule } from '@sociflow/auth'
import { AppConfigModule } from './config'
import { SentryInterceptor } from './common/sentry/sentry.interceptor'
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
        // Đồng bộ với apps/api logger redact — đảm bảo PII / secret không leak ra log.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            '*.password',
            '*.passwordHash',
            '*.token',
            '*.accessToken',
            '*.refreshToken',
            '*.apiKey',
            '*.creditCard',
          ],
          censor: '***',
        },
      },
    }),
    ProvidersModule,
    HealthModule,
    InternalAiModule,
    GenerationModule,
  ],
  providers: [
    // Sentry interceptor — capture unexpected error (5xx, infra).
    // No-op khi SENTRY_DSN rỗng (Sentry SDK self-guards).
    { provide: APP_INTERCEPTOR, useClass: SentryInterceptor },
  ],
})
export class AppModule {}
