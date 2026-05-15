'use client'
import Link from 'next/link'
import { usePublishList } from '../hooks/usePublish'
import { PublishRow } from '../components/PublishRow'

export function PublishListView() {
  const { data, isLoading } = usePublishList()

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Publish tasks</h1>
        <Link
          href="/dashboard/compose"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
        >
          + Tạo bài
        </Link>
      </header>

      {isLoading && <p className="text-muted-foreground">Đang tải...</p>}

      {!isLoading && data && data.list.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Chưa có publish task nào</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Bắt đầu bằng <Link href="/dashboard/accounts" className="text-primary hover:underline">kết nối tài khoản</Link>.
          </p>
        </div>
      )}

      {data && data.list.length > 0 && (
        <table className="w-full border-collapse rounded-lg border border-border">
          <thead>
            <tr className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Platform</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Thời gian</th>
              <th className="px-3 py-2">Link</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.list.map(r => <PublishRow key={r.id} record={r} />)}
          </tbody>
        </table>
      )}
    </div>
  )
}
