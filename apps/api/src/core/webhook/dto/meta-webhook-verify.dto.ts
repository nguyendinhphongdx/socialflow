import { z } from 'zod'

/**
 * Meta Graph webhook verification (GET) query params.
 *
 * Tài liệu: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
export const MetaWebhookVerifyQuerySchema = z.object({
  'hub.mode': z.literal('subscribe').describe('Meta gửi value `subscribe`'),
  'hub.verify_token': z.string().min(1).describe('Token tự config trong app dashboard'),
  'hub.challenge': z.string().min(1).describe('Random string echo lại'),
})

export type MetaWebhookVerifyQuery = z.infer<typeof MetaWebhookVerifyQuerySchema>
