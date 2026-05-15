'use client'
import type { FC } from 'react'
import Link from 'next/link'
import { useDeleteDraft } from '../hooks/useDrafts'
import type { Draft } from '../types'

function stripHtml(html: string | null): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export const DraftCard: FC<{ draft: Draft }> = ({ draft }) => {
  const remove = useDeleteDraft()
  const preview = stripHtml(draft.body).slice(0, 180)
  const updated = new Date(draft.updatedAt).toLocaleString('vi-VN')

  function onDelete() {
    if (!confirm('Xoá nháp này?')) return
    remove.mutate(draft.id)
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/30">
      <header className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 flex-1 font-semibold">
          {draft.title?.trim() || '(không tiêu đề)'}
        </h3>
        <span className="shrink-0 text-xs text-muted-foreground">{updated}</span>
      </header>

      {preview && (
        <p className="line-clamp-3 text-sm text-muted-foreground">{preview}</p>
      )}

      {draft.mediaIds.length > 0 && (
        <p className="text-xs text-muted-foreground">{draft.mediaIds.length} media</p>
      )}

      {draft.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {draft.tags.map(tag => (
            <li key={tag} className="rounded bg-muted px-2 py-0.5 text-xs">#{tag}</li>
          ))}
        </ul>
      )}

      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex gap-2">
          <Link
            href={`/dashboard/drafts/${draft.id}`}
            className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent"
          >
            Sửa
          </Link>
          <Link
            href={`/dashboard/drafts/${draft.id}/publish`}
            className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
          >
            Publish
          </Link>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={remove.isPending}
          className="text-xs text-destructive hover:underline disabled:opacity-50"
        >
          Xoá
        </button>
      </footer>
    </article>
  )
}
