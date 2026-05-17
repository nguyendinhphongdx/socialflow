import { z } from 'zod'
import { createZodDto as nestjsCreateZodDto } from 'nestjs-zod'

// nestjs-zod v4 dùng @nest-zod/z (fork) cho generic, kê khai TOutput=any khi nhận schema
// từ `zod` chuẩn → mất type inference. Re-type bằng z.infer<T> để khôi phục type safety
// trên DTO instance (`dto.field`) và `Dto.schema`.
export type ZodDtoClass<T extends z.ZodTypeAny> = {
  new (data?: z.input<T>): z.infer<T>
  isZodDto: true
  schema: T
  create(input: unknown): z.infer<T>
}

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
export function createZodDto<T extends z.ZodTypeAny>(schema: T, name?: string): ZodDtoClass<T> {
  const Dto = nestjsCreateZodDto(schema as never)
  if (name) Object.defineProperty(Dto, 'name', { value: name })
  return Dto as unknown as ZodDtoClass<T>
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
