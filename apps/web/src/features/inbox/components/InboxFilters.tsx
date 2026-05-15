'use client'
import { useAccounts, type AccountPlatform } from '@/features/accounts'
import type { CommentStatus, ListCommentsQuery } from '../types'

interface InboxFiltersProps {
  value: ListCommentsQuery
  onChange: (next: ListCommentsQuery) => void
}

const STATUSES: CommentStatus[] = ['NEW', 'REPLIED', 'IGNORED', 'SPAM']
const PLATFORMS: AccountPlatform[] = ['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK']

export function InboxFilters({ value, onChange }: InboxFiltersProps) {
  const { data: accounts } = useAccounts({ pageSize: 100 })

  function patch(next: Partial<ListCommentsQuery>) {
    onChange({ ...value, ...next, page: 1 })
  }

  return (
    <aside className="space-y-5 rounded-lg border border-border bg-card p-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Trạng thái</p>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => patch({ status: undefined })}
            className={`rounded-md px-3 py-1.5 text-left text-sm ${value.status === undefined ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
          >
            Tất cả
          </button>
          {STATUSES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => patch({ status: s })}
              className={`rounded-md px-3 py-1.5 text-left text-sm ${value.status === s ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Platform</p>
        <select
          value={value.platform ?? ''}
          onChange={e => patch({ platform: (e.target.value || undefined) as AccountPlatform | undefined })}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Tất cả</option>
          {PLATFORMS.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Tài khoản</p>
        <select
          value={value.accountId ?? ''}
          onChange={e => patch({ accountId: e.target.value || undefined })}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Tất cả</option>
          {accounts?.list.map(a => (
            <option key={a.id} value={a.id}>{a.platform} · {a.displayName}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Đã reply</p>
        <select
          value={value.hasReply === undefined ? '' : value.hasReply ? 'yes' : 'no'}
          onChange={(e) => {
            const v = e.target.value
            patch({ hasReply: v === '' ? undefined : v === 'yes' })
          }}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Tất cả</option>
          <option value="yes">Đã reply</option>
          <option value="no">Chưa reply</option>
        </select>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Tìm kiếm</p>
        <input
          type="text"
          value={value.search ?? ''}
          onChange={e => patch({ search: e.target.value || undefined })}
          placeholder="Nội dung hoặc author..."
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
    </aside>
  )
}
