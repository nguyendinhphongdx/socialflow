'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccounts } from '@/features/accounts'
import { MediaUploader, type MediaAsset } from '@/features/media'
import { useCreatePublish } from '../hooks/usePublish'

export function ComposeView() {
  const router = useRouter()
  const { data: accounts } = useAccounts()
  const create = useCreatePublish()

  const [accountId, setAccountId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<MediaAsset[]>([])

  const activeAccounts = accounts?.list.filter(a => a.status === 'ACTIVE') ?? []

  function onUploaded(newAssets: MediaAsset[]) {
    setMedia(prev => [...prev, ...newAssets])
  }

  function removeMedia(id: string) {
    setMedia(prev => prev.filter(m => m.id !== id))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accountId) return
    create.mutate(
      {
        accountIds: [accountId],
        title,
        body,
        mediaIds: media.map(m => m.id),
      },
      {
        onSuccess: () => router.push('/dashboard/publish'),
      },
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Tạo bài</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="account">Tài khoản</label>
          <select
            id="account"
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Chọn tài khoản...</option>
            {activeAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.platform} · {a.displayName}</option>
            ))}
          </select>
          {activeAccounts.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">Chưa có account ACTIVE nào.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={200}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="body">Body</label>
          <textarea
            id="body"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={6}
            maxLength={5000}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Media</label>
          <div className="mt-1">
            <MediaUploader accept="video/mp4,video/quicktime,video/webm,image/*" multiple onUploaded={onUploaded} />
          </div>

          {media.length > 0 && (
            <ul className="mt-3 space-y-2">
              {media.map(m => (
                <li key={m.id} className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-sm">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">{m.type}</span>
                  <span className="flex-1 truncate font-mono text-xs">{m.filename}</span>
                  <span className="text-xs text-muted-foreground">{(m.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                  <button
                    type="button"
                    onClick={() => removeMedia(m.id)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Xoá
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          disabled={create.isPending || !accountId}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {create.isPending ? 'Đang tạo...' : 'Publish ngay'}
        </button>
      </form>
    </div>
  )
}
