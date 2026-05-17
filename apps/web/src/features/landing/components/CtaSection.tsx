import Link from 'next/link'
import type { FC } from 'react'

export const CtaSection: FC = () => {
  return (
    <section className="border-t border-border/60 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-purple-500/10 p-10 text-center sm:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 to-transparent" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Sẵn sàng tăng tốc nội dung?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Tham gia cùng 5.000+ creator đang dùng Sociflow. Miễn phí mãi mãi cho gói Free.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-8 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
              >
                Tạo tài khoản miễn phí
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-12 w-full items-center justify-center rounded-md border border-border bg-background px-8 text-base font-medium transition-colors hover:bg-accent sm:w-auto"
              >
                Xem bảng giá
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
