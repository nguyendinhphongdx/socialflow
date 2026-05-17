'use client'
import type { FC } from 'react'
import { formatNumber } from '../constants'
import { useCreditBalance } from '../hooks/useCredits'
import { PlanBadge } from './PlanBadge'

export const CreditBalance: FC = () => {
  const { data, isLoading, error } = useCreditBalance()

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-2 w-full animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Không thể tải số dư credits.</p>
      </div>
    )
  }

  const allowance = data.creditsMonthlyAllowance
  const remaining = data.creditsRemaining
  const used = allowance ? Math.max(0, allowance - remaining) : 0
  const percent = allowance && allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Gói hiện tại</p>
          <div className="mt-1 flex items-center gap-2">
            <PlanBadge tier={data.planTier} />
            {data.subscriptionStatus === 'CANCELED' && (
              <span className="text-xs text-amber-600">Đã hủy — còn hiệu lực đến hết kỳ</span>
            )}
            {data.subscriptionStatus === 'PAST_DUE' && (
              <span className="text-xs text-destructive">Quá hạn thanh toán</span>
            )}
          </div>
        </div>
        {data.renewsAt && (
          <div className="text-right text-xs text-muted-foreground">
            <p>Gia hạn ngày</p>
            <p>{new Date(data.renewsAt).toLocaleDateString('vi-VN')}</p>
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground">AI credits còn lại</p>
            <p className="text-2xl font-bold">{formatNumber(remaining)}</p>
          </div>
          {allowance && (
            <p className="text-sm text-muted-foreground">/ {formatNumber(allowance)}</p>
          )}
        </div>
        {allowance && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                percent > 90 ? 'bg-destructive' : percent > 70 ? 'bg-amber-500' : 'bg-primary'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
