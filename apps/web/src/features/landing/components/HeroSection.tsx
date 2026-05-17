import Link from 'next/link'
import type { FC } from 'react'

export const HeroSection: FC = () => {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Mới: AI Agent runtime, auto-reply 5 nền tảng
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Quản lý social media{' '}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              AI-powered
            </span>{' '}
            cho creator Việt
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Đăng đồng thời lên YouTube, Facebook, Instagram, TikTok. AI viết caption,
            tự trả lời comment, phân tích hiệu suất — tất cả trong 1 dashboard.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-8 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
            >
              Bắt đầu miễn phí
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 w-full items-center justify-center rounded-md border border-border bg-background px-8 text-base font-medium transition-colors hover:bg-accent sm:w-auto"
            >
              Xem demo
            </Link>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Không cần thẻ tín dụng. 100 AI credits/tháng cho gói Free.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="aspect-[16/9] bg-gradient-to-br from-muted via-card to-muted">
              <div className="grid h-full grid-cols-12 gap-2 p-6">
                <div className="col-span-3 rounded-lg bg-background/60" />
                <div className="col-span-9 space-y-3">
                  <div className="h-8 w-1/3 rounded bg-background/60" />
                  <div className="grid grid-cols-4 gap-3">
                    <div className="h-20 rounded bg-background/60" />
                    <div className="h-20 rounded bg-background/60" />
                    <div className="h-20 rounded bg-background/60" />
                    <div className="h-20 rounded bg-background/60" />
                  </div>
                  <div className="h-40 rounded bg-background/60" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
