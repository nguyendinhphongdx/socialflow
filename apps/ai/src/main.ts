import 'reflect-metadata'
import { Logger as NestLogger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import helmet from 'helmet'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import {
  AppExceptionFilter,
  TransformInterceptor,
  ZodValidationPipe,
} from '@sociflow/common'
import { AppModule } from './app.module'
import { loadConfig } from './config'
import { initSentry } from './common/sentry/sentry.init'

const PORT = Number(process.env.AI_PORT ?? 3001)
const ENV = process.env.NODE_ENV ?? 'development'

async function bootstrap() {
  // Sentry init TRƯỚC NestFactory — capture bootstrap error.
  const bootConfig = loadConfig()
  const sentryEnabled = initSentry({
    dsn: bootConfig.sentry.dsn,
    environment: bootConfig.sentry.environment,
    release: bootConfig.sentry.release,
    tracesSampleRate: bootConfig.sentry.tracesSampleRate,
    profilesSampleRate: bootConfig.sentry.profilesSampleRate,
    serverName: 'sociflow-ai',
  })
  if (sentryEnabled) {
    new NestLogger('Sentry').log(`[ai] Sentry initialized (env=${bootConfig.sentry.environment})`)
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  app.useLogger(app.get(Logger))
  app.use(helmet())
  app.setGlobalPrefix('api/v1')
  app.useGlobalPipes(new ZodValidationPipe())
  app.useGlobalInterceptors(new TransformInterceptor())
  app.useGlobalFilters(new AppExceptionFilter())

  if (ENV !== 'production') {
    const swaggerCfg = new DocumentBuilder()
      .setTitle('Sociflow AI Service')
      .setDescription('Internal AI service (gen, agent runtime)')
      .setVersion('0.0.0')
      .build()
    SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, swaggerCfg))
  }

  await app.listen(PORT)
  new NestLogger('Bootstrap').log(`[ai] listening on http://localhost:${PORT}/api/v1`)
}

bootstrap().catch((err) => {
  new NestLogger('Bootstrap').error('[ai] bootstrap failed', err as Error)
  process.exit(1)
})
