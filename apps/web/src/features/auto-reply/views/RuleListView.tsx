'use client'
import Link from 'next/link'
import { useRules } from '../hooks/useAutoReply'
import { RuleCard } from '../components/RuleCard'

export function RuleListView() {
  const { data, isLoading } = useRules({ pageSize: 50 })

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auto-reply rules</h1>
          <p className="text-sm text-muted-foreground">Tự động trả lời comment theo keyword</p>
        </div>
        <Link
          href="/dashboard/auto-reply/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
        >
          + Tạo rule
        </Link>
      </header>

      {isLoading && <p className="text-muted-foreground">Đang tải...</p>}

      {!isLoading && data && data.list.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Chưa có rule nào</p>
          <Link
            href="/dashboard/auto-reply/new"
            className="mt-3 inline-block text-sm text-primary hover:underline"
          >
            + Tạo rule đầu tiên
          </Link>
        </div>
      )}

      {data && data.list.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.list.map(r => <RuleCard key={r.id} rule={r} />)}
        </div>
      )}
    </div>
  )
}
