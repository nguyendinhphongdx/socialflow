import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import { AppException } from '@sociflow/common'
import { type Observable, catchError, throwError } from 'rxjs'
import * as Sentry from '@sentry/node'

/**
 * Sentry interceptor cho apps/ai. KHÔNG cần CLS (ai service không có user auth).
 *
 * Skip business `AppException` + 4xx HttpException. Capture 5xx + unknown Error.
 */
@Injectable()
export class SentryInterceptor implements NestInterceptor {
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
    Sentry.captureException(err)
  }
}
