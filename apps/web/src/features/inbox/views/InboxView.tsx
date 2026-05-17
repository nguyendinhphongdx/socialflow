'use client'
import { useMemo, useState } from 'react'
import { PushOptInBanner } from '@/features/notification'
import { CommentItem } from '../components/CommentItem'
import { InboxBulkActions } from '../components/InboxBulkActions'
import { InboxFilters } from '../components/InboxFilters'
import { useComments } from '../hooks/useInbox'
import type { ListCommentsQuery } from '../types'

export function InboxView() {
  const [filters, setFilters] = useState<ListCommentsQuery>({ page: 1, pageSize: 30 })
  const { data, isLoading } = useComments(filters)

  // Selection state local — không persist qua filter change để tránh select
  // commentId không còn hiển thị.
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  function patchFilters(next: ListCommentsQuery) {
    setSelectedIds([])
    setFilters(next)
  }

  const visibleIds = useMemo(() => data?.list.map(c => c.id) ?? [], [data])

  // Drop IDs không còn visible (vd vừa archive xong) — giữ selection consistent.
  const sanitizedSelected = useMemo(
    () => selectedIds.filter(id => visibleIds.includes(id)),
    [selectedIds, visibleIds],
  )

  const allSelected = visibleIds.length > 0 && sanitizedSelected.length === visibleIds.length

  function toggleId(id: string, checked: boolean) {
    setSelectedIds(prev => (checked ? [...new Set([...prev, id])] : prev.filter(x => x !== id)))
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : visibleIds)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Inbox</h1>
        <p className="text-sm text-muted-foreground">Quản lý comment từ các kênh đã kết nối</p>
      </header>

      <PushOptInBanner />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <InboxFilters value={filters} onChange={patchFilters} />

        <main className="space-y-3">
          <InboxBulkActions
            selectedIds={sanitizedSelected}
            onClearSelection={() => setSelectedIds([])}
          />

          {isLoading && <p className="text-muted-foreground">Đang tải...</p>}

          {!isLoading && data && data.list.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-muted-foreground">Không có comment nào khớp filter</p>
            </div>
          )}

          {data && data.list.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 cursor-pointer"
                  aria-label="Chọn tất cả"
                />
                <span>Chọn tất cả trên trang ({visibleIds.length})</span>
              </div>

              {data.list.map((c) => {
                const checked = sanitizedSelected.includes(c.id)
                return (
                  <div key={c.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => toggleId(c.id, e.target.checked)}
                      className="mt-5 h-4 w-4 shrink-0 cursor-pointer"
                      aria-label={`Chọn comment ${c.id}`}
                    />
                    <div className="flex-1">
                      <CommentItem comment={c} />
                    </div>
                  </div>
                )
              })}
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
