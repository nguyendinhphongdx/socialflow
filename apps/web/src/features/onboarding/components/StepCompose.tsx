'use client'
import Link from 'next/link'
import type { FC } from 'react'
import { useAccounts } from '@/features/accounts'

interface StepComposeProps {
  onComplete: () => void
}

export const StepCompose: FC<StepComposeProps> = ({ onComplete }) => {
  const { data, isLoading } = useAccounts()
  const accountCount = data?.list?.length ?? 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tạo bài đăng đầu tiên</h2>
        <p className="mt-2 text-muted-foreground">
          Mở Compose, chọn tài khoản và đăng bài mẫu. Chúng tôi sẽ điền sẵn caption để bạn thử ngay.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium">Bài đăng mẫu</span>
          <span className="text-xs text-muted-foreground">
            {isLoading ? 'Đang tải...' : `${accountCount} tài khoản đã kết nối`}
          </span>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-background p-4 text-sm">
          <p className="font-medium">Chào mừng bạn đến với Sociflow!</p>
          <p className="text-muted-foreground">
            Đây là bài đăng đầu tiên của tôi qua Sociflow. AI đã giúp tôi tạo caption và lên lịch
            đăng cùng lúc lên nhiều nền tảng. #sociflow #content #marketing
          </p>
          <div className="flex flex-wrap gap-2 pt-2 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-2 py-1">#sociflow</span>
            <span className="rounded bg-muted px-2 py-1">#aimarketing</span>
            <span className="rounded bg-muted px-2 py-1">#creator</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/compose?onboarding=1"
          onClick={onComplete}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Mở Compose →
        </Link>
        <button
          type="button"
          onClick={onComplete}
          className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-6 text-sm font-medium transition-colors hover:bg-accent"
        >
          Đã đăng xong
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Mẹo: Bạn có thể quay lại đây bất cứ lúc nào từ menu trợ giúp.
      </p>
    </div>
  )
}
