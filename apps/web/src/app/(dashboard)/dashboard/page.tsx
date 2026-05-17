import Link from 'next/link'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Dashboard', path: '/dashboard', noIndex: true })

export default function DashboardPage() {
  return (
    <main className="container space-y-6 py-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Phase 0 + Phase 1 (foundations). Feature sẽ build tiếp.</p>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/accounts"
          className="rounded-lg border border-border p-4 hover:bg-accent"
        >
          <p className="font-semibold">Tài khoản</p>
          <p className="text-sm text-muted-foreground">Connect/disconnect social account</p>
        </Link>
        <Link
          href="/dashboard/compose"
          className="rounded-lg border border-border p-4 hover:bg-accent"
        >
          <p className="font-semibold">Tạo bài</p>
          <p className="text-sm text-muted-foreground">Compose + publish</p>
        </Link>
        <Link
          href="/dashboard/publish"
          className="rounded-lg border border-border p-4 hover:bg-accent"
        >
          <p className="font-semibold">Publish tasks</p>
          <p className="text-sm text-muted-foreground">Theo dõi trạng thái publish</p>
        </Link>
        <Link
          href="/dashboard/drafts"
          className="rounded-lg border border-border p-4 hover:bg-accent"
        >
          <p className="font-semibold">Bản nháp</p>
          <p className="text-sm text-muted-foreground">Lưu nháp, sửa lại trước khi publish</p>
        </Link>
        <Link
          href="/dashboard/calendar"
          className="rounded-lg border border-border p-4 hover:bg-accent"
        >
          <p className="font-semibold">Lịch</p>
          <p className="text-sm text-muted-foreground">Calendar view publish tasks</p>
        </Link>
        <Link
          href="/dashboard/devices"
          className="rounded-lg border border-border p-4 hover:bg-accent"
        >
          <p className="font-semibold">Thiết bị</p>
          <p className="text-sm text-muted-foreground">Browser extension paired (automation)</p>
        </Link>
        <Link
          href="/dashboard/inbox"
          className="rounded-lg border border-border p-4 hover:bg-accent"
        >
          <p className="font-semibold">Inbox</p>
          <p className="text-sm text-muted-foreground">Quản lý comment + reply manual</p>
        </Link>
        <Link
          href="/dashboard/auto-reply"
          className="rounded-lg border border-border p-4 hover:bg-accent"
        >
          <p className="font-semibold">Auto-reply</p>
          <p className="text-sm text-muted-foreground">Rule tự trả lời comment theo keyword</p>
        </Link>
        <Link
          href="/dashboard/analytics"
          className="rounded-lg border border-border p-4 hover:bg-accent"
        >
          <p className="font-semibold">Analytics</p>
          <p className="text-sm text-muted-foreground">Followers + engagement timeline</p>
        </Link>
        <Link
          href="/dashboard/settings/billing"
          className="rounded-lg border border-border p-4 hover:bg-accent"
        >
          <p className="font-semibold">Billing</p>
          <p className="text-sm text-muted-foreground">Gói đăng ký + AI credits</p>
        </Link>
      </div>
    </main>
  )
}
