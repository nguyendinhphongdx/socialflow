import type { PlanDefinition } from './types'

export const PLAN_TIERS: readonly PlanDefinition[] = [
  {
    id: 'FREE',
    name: 'Free',
    price: 0,
    currency: 'VND',
    interval: 'month',
    credits: 100,
    features: [
      '100 AI credits/tháng',
      '1 social account',
      '10 post/tháng',
      'Email support',
    ],
    cta: 'Bắt đầu miễn phí',
    highlight: false,
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 299_000,
    currency: 'VND',
    interval: 'month',
    credits: 2000,
    features: [
      '2.000 AI credits/tháng',
      '5 social account',
      'Unlimited posts',
      'Analytics đầy đủ',
      'Priority support',
    ],
    cta: 'Đăng ký Pro',
    highlight: true,
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    price: 999_000,
    currency: 'VND',
    interval: 'month',
    credits: 10_000,
    features: [
      '10.000 AI credits/tháng',
      '20 social account',
      'Multi-user team',
      'API access',
      'Dedicated support',
    ],
    cta: 'Đăng ký Business',
    highlight: false,
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: null,
    currency: 'VND',
    interval: 'month',
    credits: null,
    features: [
      'Unlimited everything',
      'SSO/SAML',
      'SLA 99.9%',
      'On-premise option',
      'Custom integration',
    ],
    cta: 'Liên hệ Sales',
    highlight: false,
  },
] as const

export const PLAN_LABELS: Record<PlanDefinition['id'], string> = {
  FREE: 'Free',
  PRO: 'Pro',
  BUSINESS: 'Business',
  ENTERPRISE: 'Enterprise',
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount)
}
