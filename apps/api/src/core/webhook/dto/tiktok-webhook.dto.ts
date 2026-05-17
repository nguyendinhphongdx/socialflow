import { z } from 'zod'

/**
 * TikTok Content Posting webhook payload.
 *
 * TikTok push status update của video sau khi user confirm publish trên app.
 * Tài liệu: https://developers.tiktok.com/doc/content-posting-api-reference-webhooks
 */
export const TikTokWebhookEventSchema = z.object({
  event: z.string().describe('post.publish.complete | post.publish.failed | ...'),
  client_key: z.string().describe('TikTok app client key'),
  user_openid: z.string().describe('OpenID của TikTok user'),
  create_time: z.number().int().nonnegative().describe('Unix epoch seconds'),
  content: z.object({
    publish_id: z.string().optional(),
    publish_type: z.string().optional(),
    publicaly_available_post_id: z.array(z.string()).optional(),
    reason: z.string().optional(),
  }).passthrough().optional(),
}).passthrough()

export const TikTokWebhookPayloadSchema = TikTokWebhookEventSchema

export type TikTokWebhookPayload = z.infer<typeof TikTokWebhookPayloadSchema>
