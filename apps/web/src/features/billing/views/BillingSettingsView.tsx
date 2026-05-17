'use client'
import Link from 'next/link'
import { useState } from 'react'
import { formatNumber } from '../constants'
import { CreditBalance } from '../components/CreditBalance'
import { useCancelSubscription, useCreditBalance, useCreditHistory } from '../hooks/useCredits'

const TX_TYPE_LABEL: Record<string, string> = {
  GRANT: 'Cấp credits',
  CONSUME: 'Tiêu dùng',
  REFUND: 'Hoàn lại',
  PURCHASE: 'Mua thêm',
}

const TX_TYPE_COLOR: Record<string, string> = {
  GRANT: 'text-green-600',
  CONSUME: 'text-muted-foreground',
  REFUND: 'text-blue-600',
  PURCHASE: 'text-primary',
}

export function BillingSettingsView() {
  const balance = useCreditBalance()
  const history = useCreditHistory(1, 20)
  const cancel = useCancelSubscription()
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const isPaidPlan = balance.data && balance.data.planTier !== 'FREE' && balance.data.subscriptionStatus === 'ACTIVE'

  return (
    <main className="container mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quản lý gói đăng ký và credits của bạn.</p>
      </header>

      <CreditBalance />

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Thay đổi gói</h2>
            <p className="text-sm text-muted-foreground">
              Upgrade để có thêm credits, social accounts và tính năng nâng cao.
            </p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Xem các gói
          </Link>
        </div>

        {isPaidPlan && (
          <div className="mt-5 border-t border-border pt-4">
            {!confirmingCancel ? (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className="text-sm text-destructive hover:underline"
              >
                Hủy gói đăng ký
              </button>
            ) : (
              <div className="space-y-3 rounded-md bg-destructive/5 p-3">
                <p className="text-sm">
                  Bạn chắc chắn muốn hủy gói? Gói vẫn hoạt động đến hết kỳ hiện tại.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => cancel.mutate(undefined, { onSettled: () => setConfirmingCancel(false) })}
                    disabled={cancel.isPending}
                    className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground disabled:opacity-50"
                  >
                    {cancel.isPending ? 'Đang hủy...' : 'Xác nhận hủy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(false)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    Quay lại
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold">Lịch sử giao dịch</h2>
        {history.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : history.error || !history.data || history.data.list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có giao dịch nào.</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.data.list.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className={`font-medium ${TX_TYPE_COLOR[tx.type] ?? ''}`}>
                    {TX_TYPE_LABEL[tx.type] ?? tx.type}
                  </p>
                  <p className="text-xs text-muted-foreground">{tx.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-foreground'}`}>
                    {tx.amount > 0 ? '+' : ''}
                    {formatNumber(tx.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">Còn lại {formatNumber(tx.balanceAfter)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
