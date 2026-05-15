'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { MediaAsset } from '@/features/media'
import { useAccounts } from '@/features/accounts'
import { useCreatePublish } from '@/features/publish'
import { useCreateDraft } from '@/features/drafts'
import { RichTextEditor } from '../components/RichTextEditor'
import { MediaPickerModal } from '../components/MediaPickerModal'
import { AccountMultiSelect } from '../components/AccountMultiSelect'
import { SchedulePicker } from '../components/SchedulePicker'
import { AiAssistButton } from '../components/AiAssistButton'
import type { AiPlatform } from '../services/aiService'

/**
 * Phase 3 compose: rich text + media picker + multi-account + schedule.
 *
 * Body lưu HTML (Tiptap render). Backend POST `body` HTML — provider tự strip
 * cho platform không support markup (vd YT description plain text).
 */
export function ComposeView() {
  const router = useRouter()
  const create = useCreatePublish()
  const saveDraft = useCreateDraft()
  const { data: accountsData } = useAccounts()

  const [accountIds, setAccountIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [media, setMedia] = useState<MediaAsset[]>([])
  const [scheduledAt, setScheduledAt] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // platform của account đầu tiên được chọn — dùng cho AI gen
  const firstSelected = accountsData?.list.find(a => accountIds.includes(a.id))
  const aiPlatform: AiPlatform | undefined = firstSelected?.platform

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (accountIds.length === 0) {
      toast.error('Chọn ít nhất 1 tài khoản')
      return
    }
    create.mutate(
      {
        accountIds,
        title,
        body: bodyHtml,
        mediaIds: media.map(m => m.id),
        publishTime: scheduledAt ?? undefined,
      },
      { onSuccess: () => router.push('/dashboard/publish') },
    )
  }

  function removeMedia(id: string) {
    setMedia(prev => prev.filter(m => m.id !== id))
  }

  function onAiResult(result: { caption: string, hashtags: string[] }) {
    const hashtagLine = result.hashtags.length > 0
      ? `\n\n${result.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
      : ''
    // Wrap thành paragraph HTML để RichTextEditor render
    setBodyHtml(`<p>${result.caption.replace(/\n/g, '<br/>')}${hashtagLine}</p>`)
  }

  function onSaveDraft() {
    if (!title.trim() && !bodyHtml.trim() && media.length === 0) {
      toast.error('Nháp trống — thêm nội dung trước')
      return
    }
    if (!confirm('Lưu nháp với nội dung hiện tại?')) return
    saveDraft.mutate(
      {
        title: title || undefined,
        body: bodyHtml || undefined,
        mediaIds: media.map(m => m.id),
        tags: [],
      },
      {
        onSuccess: (draft) => router.push(`/dashboard/drafts/${draft.id}`),
      },
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Tạo bài</h1>

      <form onSubmit={onSubmit} className="space-y-6">
        <section>
          <label className="mb-2 block text-sm font-medium">Tài khoản đăng</label>
          <AccountMultiSelect selected={accountIds} onChange={setAccountIds} />
        </section>

        <section>
          <label className="block text-sm font-medium" htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Tiêu đề bài đăng..."
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </section>

        <section>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium">Nội dung</label>
            <AiAssistButton platform={aiPlatform} onResult={onAiResult} />
          </div>
          <RichTextEditor value={bodyHtml} onChange={setBodyHtml} maxLength={5000} placeholder="Caption / mô tả..." />
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium">Media ({media.length})</label>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-sm text-primary hover:underline"
            >
              + Thêm media
            </button>
          </div>
          {media.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-6">
              {media.map(m => (
                <li key={m.id} className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
                  {m.type === 'IMAGE'
                    ? <img src={m.publicUrl} alt="" className="h-full w-full object-cover" />
                    : <div className="flex h-full items-center justify-center text-3xl">{m.type === 'VIDEO' ? '🎬' : '🎵'}</div>}
                  <button
                    type="button"
                    onClick={() => removeMedia(m.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white hover:bg-black"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <label className="mb-2 block text-sm font-medium">Thời gian publish</label>
          <SchedulePicker value={scheduledAt} onChange={setScheduledAt} />
        </section>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <button
            type="submit"
            disabled={create.isPending || accountIds.length === 0}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {create.isPending ? 'Đang tạo...' : (scheduledAt ? 'Lên lịch publish' : 'Publish ngay')}
          </button>
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saveDraft.isPending}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input px-6 text-sm hover:bg-accent disabled:opacity-50"
          >
            {saveDraft.isPending ? 'Đang lưu...' : 'Lưu nháp'}
          </button>
        </div>
      </form>

      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={assets => setMedia(prev => [...prev, ...assets])}
        multiple
        accept="image/*,video/*"
      />
    </div>
  )
}
