import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { ZodError } from 'zod'
import type { Response } from 'express'
import { AppException } from '../app-exception'
import { ResponseCode, ResponseMessage } from '../response-code'

interface ResponseEnvelopePayload {
  data: unknown
  code: number
  message: string
  timestamp: number
}

/**
 * Catch-all filter — map mọi exception về envelope `{ data, code, message, timestamp }`.
 *
 * Rules:
 * - AppException → HTTP 200 + business envelope
 * - ZodError → HTTP 200 + ValidationFailed envelope
 * - HttpException (NestJS built-in 4xx) → giữ HTTP status, envelope với code = status
 * - Unknown → HTTP 500, code InternalError, log full stack
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    if (exception instanceof AppException) {
      response.status(HttpStatus.OK).json(this.envelope({
        code: exception.code,
        message: ResponseMessage[exception.code] ?? 'Lỗi',
        data: exception.data ?? null,
      }))
      return
    }

    if (exception instanceof ZodError) {
      response.status(HttpStatus.OK).json(this.envelope({
        code: ResponseCode.ValidationFailed,
        message: ResponseMessage[ResponseCode.ValidationFailed],
        data: {
          errors: exception.issues.map(issue => ({
            path: issue.path,
            message: issue.message,
            code: issue.code,
          })),
        },
      }))
      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      response.status(status).json(this.envelope({
        code: status,
        message: typeof body === 'string' ? body : (body as { message?: string }).message ?? exception.message,
        data: null,
      }))
      return
    }

    const err = exception instanceof Error ? exception : new Error(String(exception))
    this.logger.error(`Unhandled exception: ${err.message}`, err.stack)
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(this.envelope({
      code: ResponseCode.InternalError,
      message: ResponseMessage[ResponseCode.InternalError],
      data: null,
    }))
  }

  private envelope(input: { code: number, message: string, data: unknown }): ResponseEnvelopePayload {
    return { ...input, timestamp: Date.now() }
  }
}
