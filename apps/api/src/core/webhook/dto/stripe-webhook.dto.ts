import { z } from 'zod'

/**
 * Stripe webhook payload — Stripe SDK `constructEvent` đã verify + parse trước.
 * Schema này dùng cho type-safe handler khi forward sang CreditsService.
 *
 * Note: Stripe có nhiều event type. Schema dưới chỉ cover shape chung
 * (`id`, `type`, `data.object`). Service tự narrow theo `type`.
 */
export const StripeWebhookEventSchema = z.object({
  id: z.string().describe('Stripe event ID — idempotency key'),
  type: z.string().describe('checkout.session.completed | payment_intent.succeeded | ...'),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
}).passthrough()

export type StripeWebhookEvent = z.infer<typeof StripeWebhookEventSchema>
