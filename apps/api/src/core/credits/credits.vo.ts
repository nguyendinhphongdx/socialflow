import { z } from 'zod'
import { createPaginationVo, createZodDto } from '@sociflow/common'
import type { CreditTransaction, User } from '@prisma/client'

export const CreditTransactionVoSchema = z.object({
  id: z.string(),
  amount: z.number().int().describe('Positive = grant, negative = consume'),
  type: z.enum(['PURCHASE', 'CONSUME', 'REFUND', 'ADMIN_GRANT', 'ADMIN_REVOKE', 'BONUS']),
  reason: z.string().nullable(),
  stripeInvoiceId: z.string().nullable(),
  balanceAfter: z.number().int().describe('Số dư sau khi apply transaction'),
  createdAt: z.date(),
})

export class CreditTransactionVo extends createZodDto(CreditTransactionVoSchema, 'CreditTransactionVo') {
  static create(entity: CreditTransaction): CreditTransactionVo {
    return CreditTransactionVoSchema.parse({
      id: entity.id,
      amount: entity.amount,
      type: entity.type,
      reason: entity.reason,
      stripeInvoiceId: entity.stripeInvoiceId,
      balanceAfter: entity.balanceAfter,
      createdAt: entity.createdAt,
    })
  }
}

export class CreditTransactionListVo extends createPaginationVo(
  CreditTransactionVoSchema,
  'CreditTransactionListVo',
) {}

export const CreditBalanceVoSchema = z.object({
  balance: z.number().int().describe('Số credit hiện có'),
  planTier: z.enum(['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE']),
  planExpiry: z.date().nullable(),
  monthlyAllowance: z.number().int().describe('Quota credit/tháng theo plan tier'),
})

export class CreditBalanceVo extends createZodDto(CreditBalanceVoSchema, 'CreditBalanceVo') {
  static create(input: { user: User, monthlyAllowance: number }) {
    return CreditBalanceVoSchema.parse({
      balance: input.user.aiCredits,
      planTier: input.user.planTier,
      planExpiry: input.user.planExpiry,
      monthlyAllowance: input.monthlyAllowance,
    })
  }
}

export const CheckoutSessionVoSchema = z.object({
  /// URL Stripe Checkout — FE redirect window.location.
  url: z.string().url(),
  sessionId: z.string(),
})

export class CheckoutSessionVo extends createZodDto(CheckoutSessionVoSchema, 'CheckoutSessionVo') {
  static create(session: { url: string | null, id: string }) {
    if (!session.url) {
      throw new Error('Stripe Checkout session missing URL')
    }
    return CheckoutSessionVoSchema.parse({ url: session.url, sessionId: session.id })
  }
}
