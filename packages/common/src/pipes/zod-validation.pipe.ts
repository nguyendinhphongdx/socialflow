import {
  type ArgumentMetadata,
  Injectable,
  type PipeTransform,
} from '@nestjs/common'
import { type ZodTypeAny } from 'zod'

/**
 * Global validation pipe — parse DTO qua zod schema.
 *
 * DTO class (sinh từ `createZodDto`) có static `schema: ZodTypeAny`.
 * Pipe đọc property đó qua bracket access — nếu không có, pass-through.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const metatype = metadata.metatype as unknown
    if (!metatype || typeof metatype !== 'function') return value
    const schema = (metatype as { schema?: ZodTypeAny }).schema
    if (!schema || typeof schema.parse !== 'function') return value
    return schema.parse(value)
  }
}
