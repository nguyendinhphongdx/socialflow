import { z } from 'zod'
import { createZodDto, PaginationDtoSchema } from '@sociflow/common'

const PlatformEnum = z.enum(['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK'])

export const CreateBrandMonitorDtoSchema = z.object({
  name: z.string().min(1).max(100)
    .describe('Tên monitor hiển thị nội bộ'),
  query: z.string().min(1).max(200)
    .describe('Keyword / cụm từ cần track'),
  platforms: z.array(PlatformEnum).min(1).max(4)
    .describe('Danh sách platform để search'),
  enabled: z.boolean().default(true)
    .describe('Bật/tắt polling'),
  pollIntervalMin: z.number().int().min(15).max(1440).default(60)
    .describe('Khoảng cách giữa các lần poll (phút) — min 15, max 1440 (24h)'),
}).strict()

export class CreateBrandMonitorDto extends createZodDto(CreateBrandMonitorDtoSchema, 'CreateBrandMonitorDto') {}

export const UpdateBrandMonitorDtoSchema = CreateBrandMonitorDtoSchema.partial()

export class UpdateBrandMonitorDto extends createZodDto(UpdateBrandMonitorDtoSchema, 'UpdateBrandMonitorDto') {}

export const ListBrandMonitorDtoSchema = PaginationDtoSchema.extend({
  enabled: z.coerce.boolean().optional()
    .describe('Lọc theo trạng thái enabled'),
}).strict()

export class ListBrandMonitorDto extends createZodDto(ListBrandMonitorDtoSchema, 'ListBrandMonitorDto') {}
