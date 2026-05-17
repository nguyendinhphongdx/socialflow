import Link from 'next/link'
import type { FC } from 'react'
import { IncidentList } from '../components/IncidentList'
import { StatusBanner } from '../components/StatusBanner'
import { UptimeGrid } from '../components/UptimeGrid'
import {
  getRecentIncidents,
  getSystemStatus,
  getUptimeLast90Days,
} from '../services/status.service'

export const StatusView: FC = async () => {
  const [status, incidents, uptime] = await Promise.all([
    getSystemStatus(),
    Promise.resolve(getRecentIncidents()),
    Promise.resolve(getUptimeLast90Days()),
  ])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              S
            </span>
            <span className="text-lg font-semibold tracking-tight">Sociflow</span>
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/pricing" className="hover:text-foreground">Bảng giá</Link>
            <Link href="/login" className="hover:text-foreground">Đăng nhập</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-10 px-4 py-12 sm:px-6 sm:py-16">
        <section>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Trạng thái hệ thống</h1>
          <p className="mt-2 text-muted-foreground">
            Theo dõi sức khỏe các dịch vụ Sociflow trong thời gian thực.
          </p>
        </section>

        <section>
          <StatusBanner result={status} />
        </section>

        <section className="space-y-4">
          <UptimeGrid days={uptime} />
        </section>

        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Sự cố gần đây</h2>
            <span className="text-xs text-muted-foreground">90 ngày qua</span>
          </div>
          <IncidentList incidents={incidents} />
        </section>

        <section className="rounded-xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Đăng ký nhận thông báo sự cố</p>
          <p className="mt-1">
            Gửi email tới{' '}
            <Link href="mailto:status@sociflow.io" className="text-primary hover:underline">
              status@sociflow.io
            </Link>{' '}
            để nhận cập nhật khi có sự cố ảnh hưởng tới dịch vụ.
          </p>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-4xl px-4 py-6 text-sm text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} Sociflow.
        </div>
      </footer>
    </div>
  )
}
