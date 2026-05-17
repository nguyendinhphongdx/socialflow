'use client'
import { useState } from 'react'
import {
  useBrandMonitors,
  useCreateBrandMonitor,
  useDeleteBrandMonitor,
  usePollBrandMonitorNow,
} from '../hooks/useBrandMonitors'
import { BrandMonitorForm } from '../components/BrandMonitorForm'
import { BrandMentionList } from '../components/BrandMentionList'

export function BrandMonitorView() {
  const { data, isLoading } = useBrandMonitors({ pageSize: 50 })
  const create = useCreateBrandMonitor()
  const remove = useDeleteBrandMonitor()
  const poll = usePollBrandMonitorNow()
  const [showForm, setShowForm] = useState(false)
  const [activeMonitorId, setActiveMonitorId] = useState<string | undefined>(undefined)

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Brand monitor</h1>
          <p className="text-sm text-muted-foreground">
            Tracking keyword + phân loại sentiment tự động qua AI
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
        >
          {showForm ? 'Đóng form' : '+ Tạo monitor'}
        </button>
      </header>

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-6">
          <BrandMonitorForm
            onSubmit={(input) => {
              create.mutate(input, { onSuccess: () => setShowForm(false) })
            }}
            submitting={create.isPending}
          />
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Monitors</h2>
        {isLoading && <p className="text-muted-foreground">Đang tải...</p>}
        {!isLoading && data && data.list.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-muted-foreground">Chưa có monitor nào</p>
          </div>
        )}
        {data && data.list.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.list.map((m) => {
              const isActive = activeMonitorId === m.id
              return (
                <article
                  key={m.id}
                  className={`flex flex-col gap-2 rounded-lg border bg-card p-4 ${isActive ? 'border-primary' : 'border-border'}`}
                >
                  <header className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-semibold">{m.name}</h3>
                      <p className="text-xs text-muted-foreground">Query: {m.query}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${m.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {m.enabled ? 'ON' : 'OFF'}
                    </span>
                  </header>

                  <p className="text-xs">
                    Platform: {m.platforms.join(', ') || '—'} · Poll mỗi {m.pollIntervalMin}p
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Matches: {m.matchCount} · Last poll: {m.lastPolledAt ? new Date(m.lastPolledAt).toLocaleString('vi-VN') : 'Chưa'}
                  </p>

                  <footer className="mt-auto flex items-center gap-2 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() => setActiveMonitorId(isActive ? undefined : m.id)}
                      className="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent"
                    >
                      {isActive ? 'Bỏ chọn' : 'Xem mention'}
                    </button>
                    <button
                      type="button"
                      onClick={() => poll.mutate(m.id)}
                      disabled={poll.isPending}
                      className="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
                    >
                      Poll ngay
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Xoá monitor này?')) remove.mutate(m.id)
                      }}
                      disabled={remove.isPending}
                      className="ml-auto text-xs text-destructive hover:underline disabled:opacity-50"
                    >
                      Xoá
                    </button>
                  </footer>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Mentions {activeMonitorId ? '(filter theo monitor đã chọn)' : '(tất cả monitor)'}
        </h2>
        <BrandMentionList monitorId={activeMonitorId} />
      </section>
    </div>
  )
}
