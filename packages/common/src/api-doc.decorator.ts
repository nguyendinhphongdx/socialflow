import { applyDecorators, type Type } from '@nestjs/common'
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  getSchemaPath,
} from '@nestjs/swagger'
import type { z } from 'zod'

interface ApiDocOptions {
  summary: string
  description?: string
  body?: z.ZodTypeAny | Type<unknown>
  query?: z.ZodTypeAny | Type<unknown>
  response?: Type<unknown> | [Type<unknown>]
}

/**
 * Composite Swagger decorator. Mọi controller method nên có `@ApiDoc({...})`.
 *
 * Body/query có thể là zod schema (sẽ resolve qua nestjs-zod) hoặc DTO class.
 */
export function ApiDoc(opts: ApiDocOptions): MethodDecorator & ClassDecorator {
  const decorators: Array<MethodDecorator | ClassDecorator | PropertyDecorator> = [
    ApiOperation({ summary: opts.summary, description: opts.description }),
  ]

  if (opts.body) {
    decorators.push(ApiBody({ type: opts.body as Type<unknown> }))
  }

  if (opts.query) {
    decorators.push(ApiQuery({ type: opts.query as Type<unknown> }))
  }

  if (opts.response) {
    const responseType: Type<unknown> = Array.isArray(opts.response) ? opts.response[0] : opts.response
    const isArray = Array.isArray(opts.response)
    decorators.push(
      ApiOkResponse({
        schema: {
          properties: {
            data: isArray
              ? { type: 'array', items: { $ref: getSchemaPath(responseType) } }
              : { $ref: getSchemaPath(responseType) },
            code: { type: 'number', example: 0 },
            message: { type: 'string', example: 'Thành công' },
            timestamp: { type: 'number' },
          },
        },
      }),
    )
  }

  return applyDecorators(...(decorators as MethodDecorator[]))
}
