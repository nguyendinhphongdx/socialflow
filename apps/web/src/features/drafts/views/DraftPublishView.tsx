'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AccountMultiSelect, SchedulePicker } from '@/features/compose'
import { useDraft, usePublishDraft } from '../hooks/useDrafts'

interface DraftPublishViewProps {
  draftId: string
}

function stripHtml(html: string | null): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function DraftPublishView({ draftId }: DraftPublishViewProps) {
  const router = useRouter()
  const { data: draft, isLoading } = useDraft(draftId)
  const publish = usePublishDraft(draftId)

  const [accountIds, setAccountIds] = useState<string[]>([])
  const [scheduledAt, setScheduledAt] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (accountIds.length === 0) {
      toast.error('Chọn ít nhất 1 tài khoản')
      return
    }
    publish.mutate(
      {
        accountIds,
        publishTime: scheduledAt ?? undefined,
      },
      {
        onSuccess: () => router.push('/dashboard/publish'),
      },
    )
  }

  if (isLoading) return <p className="text-muted-foreground">Đang tải...</p>
  if (!draft) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center">
        <p className="text-muted-foreground">Không tìm thấy bản nháp</p>
        <Link href="/dashboard/drafts" className="mt-3 inline-block text-sm text-primary hover:underline">
          ← Quay lại danh sách
        </Link>
      </div>
    )
  }

  const preview = stripHtml(draft.body).slice(0, 240)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Publish bản nháp</h1>
        <Link href={`/dashboard/drafts/${draftId}`} className="text-sm text-muted-foreground hover:underline">
          ← Sửa nháp
        </Link>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold">
          {draft.title?.trim() || '(không tiêu đề)'}
        </h2>
        {preview && <p className="mt-2 text-sm text-muted-foreground">{preview}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          {draft.mediaIds.length} media · {draft.tags.length} tag
        </p>
      </section>

      <form onSubmit={onSubmit} className="space-y-6">
        <section>
          <label className="mb-2 block text-sm font-medium">Tài khoản đăng</label>
          <AccountMultiSelect selected={accountIds} onChange={setAccountIds} />
        </section>

        <section>
          <label className="mb-2 block text-sm font-medium">Thời gian publish</label>
          <SchedulePicker value={scheduledAt} onChange={setScheduledAt} />
        </section>

        <div className="flex gap-2 border-t border-border pt-4">
          <button
            type="submit"
            disabled={publish.isPending || accountIds.length === 0}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {publish.isPending ? 'Đang publish...' : (scheduledAt ? 'Lên lịch publish' : 'Publish ngay')}
          </button>
          <Link
            href="/dashboard/drafts"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input px-6 text-sm hover:bg-accent"
          >
            Huỷ
          </Link>
        </div>
      </form>
    </div>
  )
}
