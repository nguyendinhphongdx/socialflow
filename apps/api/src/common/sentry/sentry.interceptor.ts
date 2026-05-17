import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import { HttpException } from '@nestjs/common'
import { RequestContextService } from '@sociflow/auth'
import { AppException } from '@sociflow/common'
import { type Observable, catchError, throwError } from 'rxjs'
import * as Sentry from '@sentry/node'

/**
 * Bắt error tại interceptor layer (CHẠY TRƯỚC `AppExceptionFilter`),
 * forward unexpected error sang Sentry với context `{ userId, traceId }`.
 *
 * Bỏ qua:
 * - `AppException` (business error — expected, không phải bug)
 * - `HttpException` 4xx (auth / not found / bad request)
 *
 * Capture:
 * - `HttpException` 5xx
 * - Mọi `Error` thông thường (DB connection lost, infra crash, code bug)
 */
@Injectable()
export class SentryInterceptor implements NestInterceptor {
  constructor(private readonly ctx: RequestContextService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((err: unknown) => {
        this.maybeCapture(err)
        return throwError(() => err)
      }),
    )
  }

  private maybeCapture(err: unknown): void {
    if (err instanceof AppException) return
    if (err instanceof HttpException) {
      const status = err.getStatus()
      if (status < 500) return
    }

    Sentry.withScope((scope) => {
      const userId = this.ctx.userId
      const traceId = this.ctx.traceId
      if (userId) scope.setUser({ id: userId })
      if (traceId) scope.setTag('trace_id', traceId)
      Sentry.captureException(err)
    })
  }
}
