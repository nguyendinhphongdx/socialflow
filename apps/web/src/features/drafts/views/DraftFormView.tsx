'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MediaPickerModal, RichTextEditor } from '@/features/compose'
import type { MediaAsset } from '@/features/media'
import { mediaService } from '@/features/media'
import { useQueries } from '@tanstack/react-query'
import { useCreateDraft, useDraft, useUpdateDraft } from '../hooks/useDrafts'
import { TagInput } from '../components/TagInput'

interface DraftFormViewProps {
  draftId?: string                          // edit mode khi có
}

export function DraftFormView({ draftId }: DraftFormViewProps) {
  const router = useRouter()
  const isEdit = Boolean(draftId)

  const { data: existing, isLoading } = useDraft(draftId)
  const create = useCreateDraft()
  const update = useUpdateDraft(draftId ?? '')

  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [mediaIds, setMediaIds] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (existing && !hydrated) {
      setTitle(existing.title ?? '')
      setBodyHtml(existing.body ?? '')
      setMediaIds(existing.mediaIds ?? [])
      setTags(existing.tags ?? [])
      setHydrated(true)
    }
  }, [existing, hydrated])

  // load media meta của mediaIds đã có để hiển thị thumbnail
  const mediaQueries = useQueries({
    queries: mediaIds.map(id => ({
      queryKey: ['media', 'detail', id],
      queryFn: () => mediaService.getById(id),
      staleTime: 60_000,
    })),
  })
  const mediaList: MediaAsset[] = mediaQueries
    .map(q => q.data)
    .filter((m): m is MediaAsset => Boolean(m))

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      title: title || undefined,
      body: bodyHtml || undefined,
      mediaIds,
      tags,
    }
    if (isEdit && draftId) {
      update.mutate(payload, {
        onSuccess: () => router.push('/dashboard/drafts'),
      })
    }
    else {
      create.mutate(payload, {
        onSuccess: draft => router.push(`/dashboard/drafts/${draft.id}`),
      })
    }
  }

  function onPickMedia(assets: MediaAsset[]) {
    const ids = assets.map(a => a.id)
    setMediaIds(prev => [...prev, ...ids.filter(id => !prev.includes(id))])
  }

  function removeMedia(id: string) {
    setMediaIds(prev => prev.filter(m => m !== id))
  }

  if (isEdit && isLoading) {
    return <p className="text-muted-foreground">Đang tải nháp...</p>
  }

  const submitting = create.isPending || update.isPending

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isEdit ? 'Sửa bản nháp' : 'Tạo bản nháp'}</h1>
        <Link href="/dashboard/drafts" className="text-sm text-muted-foreground hover:underline">
          ← Danh sách
        </Link>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        <section>
          <label className="block text-sm font-medium" htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Tiêu đề bản nháp..."
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </section>

        <section>
          <label className="mb-1 block text-sm font-medium">Nội dung</label>
          <RichTextEditor value={bodyHtml} onChange={setBodyHtml} maxLength={5000} placeholder="Caption / mô tả..." />
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium">Media ({mediaIds.length})</label>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-sm text-primary hover:underline"
            >
              + Thêm media
            </button>
          </div>
          {mediaList.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-6">
              {mediaList.map(m => (
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
          <label className="mb-1 block text-sm font-medium">Tags</label>
          <TagInput value={tags} onChange={setTags} />
          <p className="mt-1 text-xs text-muted-foreground">Nhấn Enter hoặc dấu phẩy để thêm tag</p>
        </section>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Lưu nháp')}
          </button>

          {isEdit && draftId && (
            <Link
              href={`/dashboard/drafts/${draftId}/publish`}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input px-6 text-sm hover:bg-accent"
            >
              Publish nháp này
            </Link>
          )}
        </div>
      </form>

      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onPickMedia}
        multiple
        accept="image/*,video/*"
      />
    </div>
  )
}
