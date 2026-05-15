import { Module } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import { ClsService } from 'nestjs-cls'
import { APP_CONFIG, type AppConfig } from '../../config'

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG, ClsService],
      useFactory: (config: AppConfig, cls: ClsService) => ({
        pinoHttp: {
          level: config.app.env === 'production' ? 'info' : 'debug',
          transport: config.app.env === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
          formatters: {
            log: (object) => ({
              ...object,
              traceId: cls.get('traceId'),
              userId: cls.get('userId'),
            }),
          },
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
          customLogLevel(_req, res, err) {
            if (err || res.statusCode >= 500) return 'error'
            if (res.statusCode >= 400) return 'warn'
            return 'info'
          },
        },
      }),
    }),
  ],
  exports: [LoggerModule],
})
export class AppLoggerModule {}
