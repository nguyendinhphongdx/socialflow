import 'reflect-metadata'
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

const PORT = Number(process.env.AI_PORT ?? 3001)
const ENV = process.env.NODE_ENV ?? 'development'

async function bootstrap() {
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
  console.warn(`[ai] listening on http://localhost:${PORT}/api/v1`)
}

bootstrap().catch((err) => {
  console.error('[ai] bootstrap failed:', err)
  process.exit(1)
})
