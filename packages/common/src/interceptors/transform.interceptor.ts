import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import { map, type Observable } from 'rxjs'
import { ResponseCode, ResponseMessage } from '../response-code'

interface ResponseEnvelope<T> {
  data: T
  code: number
  message: string
  timestamp: number
}

/**
 * Wrap success response thành envelope `{ data, code, message, timestamp }`.
 *
 * Nếu controller đã return envelope (có key `code`), pass-through (rare case).
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ResponseEnvelope<T> | T> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ResponseEnvelope<T> | T> {
    return next.handle().pipe(
      map((data) => {
        if (data !== null && typeof data === 'object' && 'code' in (data as object)) {
          return data as T
        }
        return {
          data,
          code: ResponseCode.Success,
          message: ResponseMessage[ResponseCode.Success],
          timestamp: Date.now(),
        }
      }),
    )
  }
}
