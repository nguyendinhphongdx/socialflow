import Link from 'next/link'
import type { FC } from 'react'

interface MiniPlan {
  name: string
  price: string
  highlight?: boolean
  features: string[]
}

const PLANS: MiniPlan[] = [
  {
    name: 'Free',
    price: '0₫',
    features: ['1 account/platform', '100 AI credits', 'Publish + Analytics cơ bản'],
  },
  {
    name: 'Pro',
    price: '299.000₫',
    highlight: true,
    features: ['10 accounts', '2.000 AI credits', 'Auto-reply, Analytics nâng cao'],
  },
  {
    name: 'Business',
    price: '799.000₫',
    features: ['Unlimited accounts', '10.000 AI credits', 'Team, API access, priority support'],
  },
]

export const PricingTeaser: FC = () => {
  return (
    <section className="border-t border-border/60 bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Giá đơn giản, minh bạch</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Bắt đầu miễn phí. Nâng cấp khi business cần thêm sức mạnh.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-xl border bg-card p-6 ${
                plan.highlight ? 'border-primary shadow-lg ring-2 ring-primary/30' : 'border-border'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Phổ biến nhất
                </span>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{plan.price}</span>
                {plan.price !== '0₫' && <span className="text-sm text-muted-foreground">/tháng</span>}
              </div>
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-6 text-sm font-medium transition-colors hover:bg-accent"
          >
            Xem chi tiết bảng giá →
          </Link>
        </div>
      </div>
    </section>
  )
}
