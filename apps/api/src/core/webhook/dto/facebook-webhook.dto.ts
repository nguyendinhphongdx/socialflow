import { z } from 'zod'

/**
 * Facebook page webhook payload.
 *
 * Tài liệu: https://developers.facebook.com/docs/graph-api/webhooks/reference/page
 *
 * Field set là superset của tất cả `change.value` shape platform có thể gửi —
 * dùng `.passthrough()` để không reject field mới (Meta thêm field không thông báo).
 */
export const FacebookChangeValueSchema = z.object({
  item: z.string().optional().describe('Loại item: comment, post, share, ...'),
  verb: z.string().optional().describe('add | edited | remove'),
  comment_id: z.string().optional(),
  post_id: z.string().optional(),
  parent_id: z.string().optional(),
  message: z.string().optional(),
  created_time: z.number().int().nonnegative().optional(),
  from: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
  }).passthrough().optional(),
}).passthrough()

export const FacebookChangeSchema = z.object({
  field: z.string().optional().describe('feed | comments | mention | messages | ...'),
  value: FacebookChangeValueSchema.optional(),
}).passthrough()

export const FacebookEntrySchema = z.object({
  id: z.string().describe('Page ID (object=page) hoặc IG User ID (object=instagram)'),
  time: z.number().int().nonnegative().optional(),
  changes: z.array(FacebookChangeSchema).optional(),
}).passthrough()

export const FacebookWebhookPayloadSchema = z.object({
  object: z.enum(['page', 'instagram']).describe('Loại subscription Meta'),
  entry: z.array(FacebookEntrySchema).describe('Mỗi entry = 1 page/ig account'),
}).passthrough()

export type FacebookChangeValue = z.infer<typeof FacebookChangeValueSchema>
export type FacebookChange = z.infer<typeof FacebookChangeSchema>
export type FacebookEntry = z.infer<typeof FacebookEntrySchema>
export type FacebookWebhookPayload = z.infer<typeof FacebookWebhookPayloadSchema>
