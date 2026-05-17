import { z } from 'zod'
import { NotificationType, type NotificationLog } from '@prisma/client'
import { createPaginationVo, createZodDto } from '@sociflow/common'

export const NotificationLogVoSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(NotificationType),
  channel: z.string(),
  recipient: z.string(),
  subject: z.string().nullable(),
  templateName: z.string(),
  status: z.string(),
  errorMessage: z.string().nullable(),
  sentAt: z.date().nullable(),
  createdAt: z.date(),
})

export class NotificationLogVo extends createZodDto(NotificationLogVoSchema, 'NotificationLogVo') {
  static create(entity: NotificationLog) {
    return NotificationLogVoSchema.parse({
      id: entity.id,
      type: entity.type,
      channel: entity.channel,
      recipient: entity.recipient,
      subject: entity.subject,
      templateName: entity.templateName,
      status: entity.status,
      errorMessage: entity.errorMessage,
      sentAt: entity.sentAt,
      createdAt: entity.createdAt,
    })
  }
}

export class NotificationLogListVo extends createPaginationVo(NotificationLogVoSchema, 'NotificationLogListVo') {}

export const SendTestEmailResultVoSchema = z.object({
  logId: z.string(),
  status: z.literal('QUEUED'),
})

export class SendTestEmailResultVo extends createZodDto(SendTestEmailResultVoSchema, 'SendTestEmailResultVo') {
  static create(logId: string) {
    return SendTestEmailResultVoSchema.parse({ logId, status: 'QUEUED' as const })
  }
}
