import { z } from 'zod'
import { createZodDto, PaginationDtoSchema } from '@sociflow/common'

/**
 * Tạo Stripe Checkout session — user mua thêm credit hoặc upgrade plan.
 *
 * Mode `payment` = one-off purchase pack credit.
 * Mode `subscription` = monthly plan (Pro / Business / Enterprise).
 */
export const CheckoutSessionDtoSchema = z.object({
  mode: z.enum(['payment', 'subscription']).default('payment')
    .describe('Mode checkout: payment = mua pack credit / subscription = đăng ký plan'),
  /// Số credit muốn mua (chỉ áp dụng cho mode=payment).
  credits: z.coerce.number().int().positive().max(1_000_000).optional()
    .describe('Số credit mua (cho mode=payment)'),
  /// Plan tier mua (chỉ áp dụng cho mode=subscription).
  planTier: z.enum(['PRO', 'BUSINESS', 'ENTERPRISE']).optional()
    .describe('Plan tier cần subscribe (cho mode=subscription)'),
  /// Override successUrl (vd: redirect lại đúng tab user đang ở).
  successUrl: z.string().url().max(2048).optional()
    .describe('URL Stripe redirect sau khi success (override default)'),
  cancelUrl: z.string().url().max(2048).optional()
    .describe('URL Stripe redirect sau khi cancel'),
}).strict()
  .refine(
    (v) => (v.mode === 'payment' ? !!v.credits : !!v.planTier),
    { message: 'Cần `credits` cho mode=payment hoặc `planTier` cho mode=subscription' },
  )

export class CheckoutSessionDto extends createZodDto(CheckoutSessionDtoSchema, 'CheckoutSessionDto') {}

export const ListHistoryDtoSchema = PaginationDtoSchema.extend({}).strict()

export class ListHistoryDto extends createZodDto(ListHistoryDtoSchema, 'ListHistoryDto') {}
