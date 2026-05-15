import { z } from 'zod'
import { createZodDto as nestjsCreateZodDto } from 'nestjs-zod'

type NestZodDtoReturn<T extends z.ZodTypeAny> = ReturnType<typeof nestjsCreateZodDto<T>>

/**
 * DTO/VO factory wrapping nestjs-zod's `createZodDto` với tên class (Swagger schema name).
 *
 * Usage:
 * ```ts
 * export class CreatePostDto extends createZodDto(CreatePostDtoSchema, 'CreatePostDto') {}
 * ```
 *
 * `dto.parse(input)` (instance) hoặc `Dto.schema.parse(input)` (static) đều work.
 */
export function createZodDto<T extends z.ZodTypeAny>(schema: T, name?: string): NestZodDtoReturn<T> {
  const Dto = nestjsCreateZodDto(schema)
  if (name) Object.defineProperty(Dto, 'name', { value: name })
  return Dto as NestZodDtoReturn<T>
}

/**
 * Pagination VO factory — tạo class với generic item schema.
 *
 * Usage:
 * ```ts
 * export class PostListVo extends createPaginationVo(PostVoSchema, 'PostListVo') {}
 * ```
 */
export function createPaginationVo<T extends z.ZodTypeAny>(itemSchema: T, name?: string) {
  const schema = z.object({
    list: z.array(itemSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  return createZodDto(schema, name)
}

/**
 * Response envelope schema — wrap mọi response thành công.
 * Dùng cho ts-rest contract.
 */
export function ResponseEnvelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    code: z.literal(0),
    message: z.string(),
    timestamp: z.number(),
  })
}

export { z }
