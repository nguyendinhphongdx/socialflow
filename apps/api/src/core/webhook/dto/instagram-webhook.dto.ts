import { z } from 'zod'
import { FacebookChangeSchema, FacebookEntrySchema } from './facebook-webhook.dto'

/**
 * Instagram webhook payload — share schema với Facebook (Meta Graph API)
 * nhưng `object` luôn là 'instagram'. Tách type riêng để type-safe
 * cho handler IG (publish status, mentions, comments).
 *
 * Tài liệu: https://developers.facebook.com/docs/instagram-platform/webhooks
 */
export const InstagramWebhookPayloadSchema = z.object({
  object: z.literal('instagram'),
  entry: z.array(FacebookEntrySchema),
}).passthrough()

export type InstagramWebhookPayload = z.infer<typeof InstagramWebhookPayloadSchema>

// Re-export Change schema vì IG dùng cùng shape
export { FacebookChangeSchema as InstagramChangeSchema }
