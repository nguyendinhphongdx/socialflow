export type PlanTier = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE'

export interface PlanDefinition {
  id: PlanTier
  name: string
  price: number | null
  currency: 'VND' | 'USD'
  interval: 'month' | 'year'
  credits: number | null
  features: readonly string[]
  cta: string
  highlight: boolean
}

export interface CreditBalanceData {
  planTier: PlanTier
  creditsRemaining: number
  creditsMonthlyAllowance: number | null
  renewsAt: string | null
  subscriptionStatus: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'NONE'
}

export interface CreditTransaction {
  id: string
  type: 'GRANT' | 'CONSUME' | 'REFUND' | 'PURCHASE'
  amount: number
  balanceAfter: number
  reason: string
  createdAt: string
}

export interface CreditTransactionListResponse {
  list: CreditTransaction[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CheckoutSessionResponse {
  sessionId: string
  url: string | null
}

export interface CreateCheckoutInput {
  planId: Exclude<PlanTier, 'FREE' | 'ENTERPRISE'>
}
