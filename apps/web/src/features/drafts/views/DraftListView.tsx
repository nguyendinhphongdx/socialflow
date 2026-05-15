'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useDrafts } from '../hooks/useDrafts'
import { DraftCard } from '../components/DraftCard'

export function DraftListView() {
  const [tag, setTag] = useState('')
  const { data, isLoading } = useDrafts({ pageSize: 50, ...(tag ? { tag } : {}) })

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Bản nháp</h1>
        <div className="flex flex-1 items-center gap-2 sm:justify-end">
          <input
            type="text"
            value={tag}
            onChange={e => setTag(e.target.value)}
            placeholder="Lọc theo tag..."
            className="h-10 w-full max-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
          />
          <Link
            href="/dashboard/drafts/new"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
          >
            + Tạo nháp
          </Link>
        </div>
      </header>

      {isLoading && <p className="text-muted-foreground">Đang tải...</p>}

      {!isLoading && data && data.list.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">
            {tag ? `Không có nháp nào với tag "${tag}"` : 'Chưa có bản nháp nào'}
          </p>
          <Link
            href="/dashboard/drafts/new"
            className="mt-3 inline-block text-sm text-primary hover:underline"
          >
            + Tạo nháp đầu tiên
          </Link>
        </div>
      )}

      {data && data.list.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.list.map(d => <DraftCard key={d.id} draft={d} />)}
        </div>
      )}

      {data && data.total > data.list.length && (
        <p className="text-center text-xs text-muted-foreground">
          Hiển thị {data.list.length}/{data.total}
        </p>
      )}
    </div>
  )
}
