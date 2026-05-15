import { z } from 'zod'
import { createZodDto, PaginationDtoSchema } from '@sociflow/common'

export const CreateDraftDtoSchema = z.object({
  title: z.string().max(200).optional()
    .describe('Tiêu đề bài (tuỳ chọn)'),
  body: z.string().max(5000).optional()
    .describe('Nội dung / caption (tuỳ chọn)'),
  mediaIds: z.array(z.string().cuid()).max(20).default([])
    .describe('Media asset IDs đính kèm'),
  platformOptions: z.record(z.string(), z.unknown()).optional()
    .describe('Override theo từng nền tảng (privacy, category, ...)'),
  tags: z.array(z.string().max(50)).max(10).default([])
    .describe('Tag để phân loại nháp'),
}).strict()

export class CreateDraftDto extends createZodDto(CreateDraftDtoSchema, 'CreateDraftDto') {}

export const UpdateDraftDtoSchema = CreateDraftDtoSchema.partial()

export class UpdateDraftDto extends createZodDto(UpdateDraftDtoSchema, 'UpdateDraftDto') {}

export const ListDraftDtoSchema = PaginationDtoSchema.extend({
  tag: z.string().max(50).optional()
    .describe('Lọc nháp theo tag (1 tag duy nhất)'),
}).strict()

export class ListDraftDto extends createZodDto(ListDraftDtoSchema, 'ListDraftDto') {}

export const PublishDraftDtoSchema = z.object({
  accountIds: z.array(z.string().cuid()).min(1).max(50)
    .describe('Danh sách SocialAccount.id để publish'),
  publishTime: z.coerce.date().optional()
    .describe('Thời điểm publish (ISO 8601). Bỏ trống = publish ngay'),
  idempotencyKey: z.string().max(64).optional()
    .describe('Idempotency key cho publish bundle'),
}).strict()

export class PublishDraftDto extends createZodDto(PublishDraftDtoSchema, 'PublishDraftDto') {}
