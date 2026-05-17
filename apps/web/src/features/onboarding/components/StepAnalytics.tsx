'use client'
import Link from 'next/link'
import type { FC } from 'react'

interface StepAnalyticsProps {
  onFinish: () => void
}

interface MetricCard {
  label: string
  value: string
  delta: string
  positive: boolean
}

const METRICS: MetricCard[] = [
  { label: 'Reach', value: '1.2K', delta: '+24%', positive: true },
  { label: 'Engagement', value: '8.4%', delta: '+3.1%', positive: true },
  { label: 'Comment mới', value: '38', delta: '+12', positive: true },
  { label: 'Follower mới', value: '17', delta: '+5', positive: true },
]

export const StepAnalytics: FC<StepAnalyticsProps> = ({ onFinish }) => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Xem hiệu suất bài đăng</h2>
        <p className="mt-2 text-muted-foreground">
          Sau khi bài đăng được xuất bản, analytics sẽ cập nhật real-time. Đây là preview giao diện:
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold">{metric.value}</span>
              <span
                className={`text-xs font-medium ${
                  metric.positive ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {metric.delta}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tăng trưởng 7 ngày qua</h3>
          <span className="text-xs text-muted-foreground">Demo</span>
        </div>
        <div className="flex h-32 items-end gap-2">
          {[24, 36, 28, 52, 48, 64, 72].map((value, idx) => (
            <div
              key={idx}
              className="flex-1 rounded-t bg-gradient-to-t from-primary/30 to-primary/70"
              style={{ height: `${value}%` }}
              aria-hidden
            />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
        <p className="font-medium">Hoàn tất onboarding!</p>
        <p className="mt-1 text-muted-foreground">
          Bạn đã sẵn sàng sử dụng Sociflow. Khám phá thêm tính năng AI, auto-reply, scheduling trong dashboard.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/analytics"
          onClick={onFinish}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Xem Analytics đầy đủ
        </Link>
        <Link
          href="/dashboard"
          onClick={onFinish}
          className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-6 text-sm font-medium transition-colors hover:bg-accent"
        >
          Đi tới Dashboard
        </Link>
      </div>
    </div>
  )
}
