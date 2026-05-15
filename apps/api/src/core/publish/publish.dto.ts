import { z } from 'zod'
import { createZodDto, PaginationDtoSchema } from '@sociflow/common'

export const CreatePublishDtoSchema = z.object({
  accountIds: z.array(z.string().cuid()).min(1).max(50)
    .describe('Danh sách SocialAccount.id muốn publish (multi-platform bundle)'),
  title: z.string().max(200).optional(),
  body: z.string().max(5000).optional(),
  mediaIds: z.array(z.string().cuid()).max(20).default([])
    .describe('Media asset IDs (đã UPLOADED)'),
  publishTime: z.coerce.date().optional()
    .describe('Scheduled time. Omit = publish now'),
  platformOptions: z.record(z.string(), z.unknown()).optional()
    .describe('Per-platform override (privacy, category, ...)'),
  idempotencyKey: z.string().max(64).optional()
    .describe('Idempotency key — same key + content → trả về record cũ'),
}).strict()

export class CreatePublishDto extends createZodDto(CreatePublishDtoSchema, 'CreatePublishDto') {}

export const ListPublishDtoSchema = PaginationDtoSchema.extend({
  status: z.enum([
    'PENDING', 'SCHEDULED', 'WAITING_AGENT', 'DISPATCHED', 'IN_PROGRESS',
    'REVIEW_PENDING', 'PUBLISHED', 'FAILED', 'CANCELLED', 'REJECTED',
  ]).optional(),
  accountId: z.string().cuid().optional(),
  flowId: z.string().optional(),
}).strict()

export class ListPublishDto extends createZodDto(ListPublishDtoSchema, 'ListPublishDto') {}
