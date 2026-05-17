'use client'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { useRouter } from 'next/navigation'
import { type FC, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth'
import { useCheckout } from '../hooks/useCheckout'
import type { CreateCheckoutInput } from '../types'

let stripePromise: Promise<Stripe | null> | null = null

function getStripe(): Promise<Stripe | null> {
  if (stripePromise) return stripePromise
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) {
    return Promise.resolve(null)
  }
  stripePromise = loadStripe(key)
  return stripePromise
}

// Stripe redirectToCheckout is deprecated; prefer URL returned from backend.
interface LegacyStripe {
  redirectToCheckout: (opts: { sessionId: string }) => Promise<{ error?: { message?: string } }>
}

interface CheckoutButtonProps {
  planId: CreateCheckoutInput['planId']
  children: ReactNode
  className?: string
  highlight?: boolean
}

export const CheckoutButton: FC<CheckoutButtonProps> = ({ planId, children, className, highlight }) => {
  const { mutate, isPending } = useCheckout()
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  const base = highlight
    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
    : 'border border-border bg-background hover:bg-accent'

  const handleClick = () => {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent('/pricing')}`)
      return
    }
    mutate(
      { planId },
      {
        onSuccess: async ({ sessionId, url }) => {
          if (url) {
            window.location.href = url
            return
          }
          const stripe = (await getStripe()) as unknown as LegacyStripe | null
          if (!stripe?.redirectToCheckout) {
            toast.error('Stripe chưa được cấu hình')
            return
          }
          const result = await stripe.redirectToCheckout({ sessionId })
          if (result.error) toast.error(result.error.message ?? 'Không thể chuyển tới thanh toán')
        },
        onError: (err: { message?: string }) => {
          toast.error(err.message ?? 'Không thể tạo phiên thanh toán')
        },
      },
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${base} ${className ?? ''}`}
    >
      {isPending ? 'Đang xử lý...' : children}
    </button>
  )
}
