import { Global, Module } from '@nestjs/common'
import { ClsModule } from 'nestjs-cls'
import { v7 as uuidv7 } from 'uuid'
import { RequestContextService } from './request-context.service'

/**
 * Global request context module.
 *
 * Setup CLS middleware bắt mọi request, generate `traceId` (UUID v7 — sortable).
 * Import 1 lần ở `AppModule.imports` (đầu tiên).
 */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: () => uuidv7(),
        setup: (cls, req: { headers?: Record<string, string | string[] | undefined>, ip?: string }) => {
          const headerTraceId = req.headers?.['x-trace-id']
          cls.set('traceId', typeof headerTraceId === 'string' ? headerTraceId : cls.getId())
          cls.set('ip', req.ip)
          cls.set('userAgent', req.headers?.['user-agent'])
        },
      },
    }),
  ],
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class ContextModule {}
