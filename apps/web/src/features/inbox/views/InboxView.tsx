'use client'
import { useState } from 'react'
import { CommentItem } from '../components/CommentItem'
import { InboxFilters } from '../components/InboxFilters'
import { useComments } from '../hooks/useInbox'
import type { ListCommentsQuery } from '../types'

export function InboxView() {
  const [filters, setFilters] = useState<ListCommentsQuery>({ page: 1, pageSize: 30 })
  const { data, isLoading } = useComments(filters)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="text-sm text-muted-foreground">Quản lý comment từ các kênh đã kết nối</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <InboxFilters value={filters} onChange={setFilters} />

        <main className="space-y-3">
          {isLoading && <p className="text-muted-foreground">Đang tải...</p>}

          {!isLoading && data && data.list.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-muted-foreground">Không có comment nào khớp filter</p>
            </div>
          )}

          {data && data.list.length > 0 && (
            <>
              {data.list.map(c => <CommentItem key={c.id} comment={c} />)}
              <p className="text-center text-xs text-muted-foreground">
                Hiển thị {data.list.length}/{data.total}
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
