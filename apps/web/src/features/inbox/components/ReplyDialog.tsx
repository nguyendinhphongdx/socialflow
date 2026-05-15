'use client'
import { useEffect, useState } from 'react'
import { useReplyComment } from '../hooks/useInbox'

interface ReplyDialogProps {
  open: boolean
  onClose: () => void
  commentId: string
  authorName: string
}

const MAX = 1000
const MIN = 1

export function ReplyDialog({ open, onClose, commentId, authorName }: ReplyDialogProps) {
  const [text, setText] = useState('')
  const reply = useReplyComment(commentId)

  useEffect(() => {
    if (!open) setText('')
  }, [open])

  if (!open) return null

  const trimmed = text.trim()
  const valid = trimmed.length >= MIN && trimmed.length <= MAX

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    reply.mutate(
      { text: trimmed },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-card p-6"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Reply tới {authorName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </header>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={5}
              maxLength={MAX}
              placeholder="Nội dung reply..."
              autoFocus
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {trimmed.length}/{MAX}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={!valid || reply.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {reply.isPending ? 'Đang gửi...' : 'Gửi reply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
