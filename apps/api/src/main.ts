import 'reflect-metadata'
import { json } from 'express'
import { NestFactory } from '@nestjs/core'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { Logger } from 'nestjs-pino'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import {
  AppExceptionFilter,
  TransformInterceptor,
  ZodValidationPipe,
} from '@sociflow/common'
import { AppModule } from './app.module'
import { APP_CONFIG, type AppConfig } from './config'

async function bootstrap() {
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
        (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf)
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
  app.useWebSocketAdapter(new IoAdapter(app))

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
  console.warn(`[api] listening on http://localhost:${config.app.port}/api/v1`)
}

bootstrap().catch((err) => {
  console.error('[api] bootstrap failed:', err)
  process.exit(1)
})
