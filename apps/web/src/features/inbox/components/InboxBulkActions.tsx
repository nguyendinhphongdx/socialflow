'use client'
import { useState } from 'react'
import {
  useBulkArchive,
  useBulkDelete,
  useBulkMarkReplied,
  useBulkReply,
} from '../hooks/useInbox'

interface InboxBulkActionsProps {
  selectedIds: string[]
  onClearSelection: () => void
}

/**
 * Action bar bulk inbox — hiển thị khi có ≥1 comment được chọn.
 * Confirm dialog cho destructive action (delete).
 */
export function InboxBulkActions({ selectedIds, onClearSelection }: InboxBulkActionsProps) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')

  const bulkReply = useBulkReply()
  const bulkMarkReplied = useBulkMarkReplied()
  const bulkArchive = useBulkArchive()
  const bulkDelete = useBulkDelete()

  if (selectedIds.length === 0) return null

  const busy = bulkReply.isPending
    || bulkMarkReplied.isPending
    || bulkArchive.isPending
    || bulkDelete.isPending

  function clearAfter() {
    setReplyOpen(false)
    setReplyText('')
    onClearSelection()
  }

  function onBulkReply() {
    if (replyText.trim().length === 0) return
    bulkReply.mutate(
      { commentIds: selectedIds, replyText },
      { onSettled: clearAfter },
    )
  }

  function onBulkMarkReplied() {
    bulkMarkReplied.mutate({ commentIds: selectedIds }, { onSettled: clearAfter })
  }

  function onBulkArchive() {
    if (!confirm(`Archive ${selectedIds.length} comment?`)) return
    bulkArchive.mutate({ commentIds: selectedIds }, { onSettled: clearAfter })
  }

  function onBulkDelete() {
    if (!confirm(`Xoá ${selectedIds.length} comment? Hành động không thể hoàn tác.`)) return
    bulkDelete.mutate({ commentIds: selectedIds }, { onSettled: clearAfter })
  }

  return (
    <div className="sticky top-0 z-10 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">
          Đã chọn {selectedIds.length}
        </span>
        <button
          type="button"
          onClick={onClearSelection}
          className="text-xs text-muted-foreground hover:underline"
          disabled={busy}
        >
          Bỏ chọn
        </button>

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReplyOpen(v => !v)}
            disabled={busy}
            className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Reply all
          </button>
          <button
            type="button"
            onClick={onBulkMarkReplied}
            disabled={busy}
            className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            Mark replied
          </button>
          <button
            type="button"
            onClick={onBulkArchive}
            disabled={busy}
            className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            Archive
          </button>
          <button
            type="button"
            onClick={onBulkDelete}
            disabled={busy}
            className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {replyOpen && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Nội dung reply áp dụng cho tất cả..."
            rows={3}
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={busy}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setReplyOpen(false); setReplyText('') }}
              disabled={busy}
              className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={onBulkReply}
              disabled={busy || replyText.trim().length === 0}
              className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? 'Đang gửi...' : `Reply ${selectedIds.length} comment`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
