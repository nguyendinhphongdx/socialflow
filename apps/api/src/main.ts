import 'reflect-metadata'
import { json } from 'express'
import { Logger as NestLogger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { SociflowSocketIoAdapter } from './libs/ws/socket-io.adapter'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import {
  AppExceptionFilter,
  TransformInterceptor,
  ZodValidationPipe,
} from '@sociflow/common'
import { AppModule } from './app.module'
import { APP_CONFIG, type AppConfig, loadConfig } from './config'
import { initSentry } from './common/sentry/sentry.init'

async function bootstrap() {
  // Init Sentry TRƯỚC khi NestFactory.create — đảm bảo capture được bootstrap error.
  // Reload config standalone vì AppConfigModule chưa instantiate ở thời điểm này.
  const bootConfig = loadConfig()
  const sentryEnabled = initSentry({
    dsn: bootConfig.sentry.dsn,
    environment: bootConfig.sentry.environment,
    release: bootConfig.sentry.release,
    tracesSampleRate: bootConfig.sentry.tracesSampleRate,
    profilesSampleRate: bootConfig.sentry.profilesSampleRate,
    serverName: 'sociflow-api',
  })
  if (sentryEnabled) {
    new NestLogger('Sentry').log(`[api] Sentry initialized (env=${bootConfig.sentry.environment})`)
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  app.useLogger(app.get(Logger))

  const config = app.get<AppConfig>(APP_CONFIG)

  app.use(cookieParser())
  app.use(helmet({
    contentSecurityPolicy: config.app.env === 'production' ? undefined : false,
  }))

  // Raw body capture cho webhook signature verify (FB/Stripe/Meta HMAC).
  // Phải set TRƯỚC global body parser của NestJS — nhưng NestFactory.create
  // đã setup express() rồi, chỉ cần overwrite json parser.
  app.use(json({
    verify: (req, _res, buf) => {
      if (req.url?.startsWith('/api/v1/webhook/')) {
        (req as unknown as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf)
      }
    },
  }))
  // HTTP CORS — Socket.IO có CORS riêng cấu hình ở @WebSocketGateway decorator
  // (chrome-extension://* được match qua regex bên trong adapter — origin: true).
  app.enableCors({
    origin: [
      ...config.app.corsOrigins,
      /^chrome-extension:\/\/.+$/,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  })

  // Socket.IO adapter cho WS Gateway (apps/api/src/core/agent/ws/agent.gateway.ts)
  // Custom adapter đọc CORS whitelist từ config (xem libs/ws/socket-io.adapter.ts).
  app.useWebSocketAdapter(new SociflowSocketIoAdapter(app))

  app.setGlobalPrefix('api/v1')
  app.useGlobalPipes(new ZodValidationPipe())
  app.useGlobalInterceptors(new TransformInterceptor())
  app.useGlobalFilters(new AppExceptionFilter())

  if (config.app.env !== 'production') {
    const swaggerCfg = new DocumentBuilder()
      .setTitle('Sociflow API')
      .setDescription('Internal REST API for Sociflow')
      .setVersion('0.0.0')
      .addBearerAuth()
      .addCookieAuth(config.auth.accessCookieName)
      .build()
    SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, swaggerCfg))
  }

  await app.listen(config.app.port)
  new NestLogger('Bootstrap').log(`[api] listening on http://localhost:${config.app.port}/api/v1`)
}

bootstrap().catch((err) => {
  new NestLogger('Bootstrap').error('[api] bootstrap failed', err as Error)
  process.exit(1)
})
