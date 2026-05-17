import { z } from 'zod'
import { NotificationType } from '@prisma/client'
import { createZodDto, PaginationDtoSchema } from '@sociflow/common'

/**
 * Internal admin endpoint: gửi test email cho 1 user theo template + payload.
 * KHÔNG expose public — chỉ admin trigger để verify SMTP / template render.
 */
export const SendTestEmailDtoSchema = z.object({
  userId: z.string().cuid().describe('User ID nhận test email'),
  type: z.nativeEnum(NotificationType).describe('Loại template'),
  templateData: z.record(z.string(), z.unknown()).default({})
    .describe('Payload truyền vào template (vd: name, verifyUrl, ...)'),
}).strict()

export class SendTestEmailDto extends createZodDto(SendTestEmailDtoSchema, 'SendTestEmailDto') {}

export const ListNotificationDtoSchema = PaginationDtoSchema.extend({}).strict()
export class ListNotificationDto extends createZodDto(ListNotificationDtoSchema, 'ListNotificationDto') {}
