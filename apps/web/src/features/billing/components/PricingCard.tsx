import Link from 'next/link'
import type { FC } from 'react'
import { formatVnd } from '../constants'
import type { CreateCheckoutInput, PlanDefinition, PlanTier } from '../types'
import { CheckoutButton } from './CheckoutButton'

type CheckoutPlan = CreateCheckoutInput['planId']

function isCheckoutPlan(id: PlanTier): id is CheckoutPlan {
  return id === 'PRO' || id === 'BUSINESS'
}

interface PricingCardProps {
  plan: PlanDefinition
  currentPlan?: PlanDefinition['id'] | null
}

export const PricingCard: FC<PricingCardProps> = ({ plan, currentPlan }) => {
  const isCurrent = currentPlan === plan.id
  const isFree = plan.id === 'FREE'
  const isEnterprise = plan.id === 'ENTERPRISE'

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm ${
        plan.highlight ? 'border-primary ring-2 ring-primary/30' : 'border-border'
      }`}
    >
      {plan.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
          Phổ biến nhất
        </span>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEnterprise ? 'Giải pháp tùy chỉnh cho doanh nghiệp' : isFree ? 'Trải nghiệm sản phẩm miễn phí' : 'Dành cho team chuyên nghiệp'}
        </p>
      </div>

      <div className="mb-6">
        {plan.price === null ? (
          <p className="text-3xl font-bold">Liên hệ</p>
        ) : plan.price === 0 ? (
          <p className="text-3xl font-bold">Miễn phí</p>
        ) : (
          <>
            <p className="text-3xl font-bold">{formatVnd(plan.price)}</p>
            <p className="text-sm text-muted-foreground">/ {plan.interval === 'month' ? 'tháng' : 'năm'}</p>
          </>
        )}
      </div>

      <ul className="mb-6 flex-1 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <CheckIcon />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        {isCurrent ? (
          <div className="inline-flex w-full items-center justify-center rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
            Gói hiện tại
          </div>
        ) : isFree ? (
          <Link
            href="/register"
            className="inline-flex w-full items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {plan.cta}
          </Link>
        ) : isEnterprise ? (
          <Link
            href="mailto:sales@sociflow.io"
            className="inline-flex w-full items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {plan.cta}
          </Link>
        ) : isCheckoutPlan(plan.id) ? (
          <CheckoutButton planId={plan.id} highlight={plan.highlight}>
            {plan.cta}
          </CheckoutButton>
        ) : null}
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42L8.5 12.09l6.79-6.8a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}
