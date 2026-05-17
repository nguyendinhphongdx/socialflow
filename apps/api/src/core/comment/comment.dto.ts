import { z } from 'zod'
import { createZodDto, PaginationDtoSchema } from '@sociflow/common'

const PlatformSchema = z.enum(['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK'])
const StatusSchema = z.enum(['NEW', 'REPLIED', 'IGNORED', 'SPAM', 'HIDDEN', 'DELETED'])

export const ListCommentDtoSchema = PaginationDtoSchema.extend({
  status: StatusSchema.optional().describe('Lọc theo trạng thái'),
  accountId: z.string().cuid().optional().describe('Lọc theo account'),
  platform: PlatformSchema.optional().describe('Lọc theo platform'),
  publishRecordId: z.string().cuid().optional().describe('Lọc theo bài đăng'),
  hasReply: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform(v => (typeof v === 'boolean' ? v : v === 'true'))
    .optional()
    .describe('true = đã reply, false = chưa reply'),
  search: z.string().max(200).optional().describe('Tìm trong text + authorName'),
}).strict()

export class ListCommentDto extends createZodDto(ListCommentDtoSchema, 'ListCommentDto') {}

export const ReplyCommentDtoSchema = z.object({
  text: z.string().min(1).max(8000).describe('Nội dung reply'),
}).strict()

export class ReplyCommentDto extends createZodDto(ReplyCommentDtoSchema, 'ReplyCommentDto') {}

export const MarkCommentDtoSchema = z.object({
  action: z.enum(['read', 'ignore', 'spam']).describe('Hành động đánh dấu'),
}).strict()

export class MarkCommentDto extends createZodDto(MarkCommentDtoSchema, 'MarkCommentDto') {}

const BulkCommentIdsSchema = z
  .array(z.string().cuid())
  .min(1, 'Phải có ít nhất 1 commentId')
  .max(100, 'Tối đa 100 commentId/request')

export const BulkActionDtoSchema = z.object({
  commentIds: BulkCommentIdsSchema.describe('Danh sách commentId (≤100)'),
}).strict()

export class BulkActionDto extends createZodDto(BulkActionDtoSchema, 'BulkActionDto') {}

export const BulkReplyDtoSchema = z.object({
  commentIds: BulkCommentIdsSchema.describe('Danh sách commentId (≤100)'),
  replyText: z.string().min(1).max(8000).describe('Nội dung reply áp dụng cho tất cả'),
}).strict()

export class BulkReplyDto extends createZodDto(BulkReplyDtoSchema, 'BulkReplyDto') {}
