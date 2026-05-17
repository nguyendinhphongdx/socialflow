import { z } from 'zod'
import { createZodDto } from '@sociflow/common'

/**
 * Body từ FE sau khi `pushManager.subscribe(...)` thành công.
 * Shape align với PushSubscriptionJSON (W3C Push API).
 */
export const SubscribePushDtoSchema = z.object({
  endpoint: z.string().url().describe('Push service endpoint (FCM / Mozilla / etc)'),
  keys: z.object({
    p256dh: z.string().min(1).describe('ECDH public key (base64url)'),
    auth: z.string().min(1).describe('Auth secret (base64url)'),
  }),
  deviceTag: z.string().max(120).optional().describe('Nhãn device do user đặt'),
}).strict()

export class SubscribePushDto extends createZodDto(SubscribePushDtoSchema, 'SubscribePushDto') {}
