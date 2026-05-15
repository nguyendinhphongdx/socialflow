'use client'
import type { FC } from 'react'
import { useState } from 'react'
import { useDeleteComment, useMarkComment } from '../hooks/useInbox'
import type { Comment, CommentStatus } from '../types'
import { ReplyDialog } from './ReplyDialog'

const STATUS_COLOR: Record<CommentStatus, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  REPLIED: 'bg-green-100 text-green-800',
  IGNORED: 'bg-gray-100 text-gray-800',
  SPAM: 'bg-red-100 text-red-800',
}

const PLATFORM_COLOR: Record<Comment['platform'], string> = {
  YOUTUBE: 'bg-red-100 text-red-800',
  FACEBOOK: 'bg-blue-100 text-blue-800',
  INSTAGRAM: 'bg-pink-100 text-pink-800',
  TIKTOK: 'bg-black text-white',
}

export const CommentItem: FC<{ comment: Comment }> = ({ comment }) => {
  const [replyOpen, setReplyOpen] = useState(false)
  const mark = useMarkComment(comment.id)
  const remove = useDeleteComment()

  const created = new Date(comment.platformCreatedAt).toLocaleString('vi-VN')

  function onDelete() {
    if (!confirm('Xoá comment này?')) return
    remove.mutate(comment.id)
  }

  const busy = mark.isPending || remove.isPending

  return (
    <article className="flex gap-3 rounded-lg border border-border bg-card p-4">
      <div className="shrink-0">
        {comment.authorAvatarUrl
          ? <img src={comment.authorAvatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          : <div className="h-10 w-10 rounded-full bg-muted" />}
      </div>

      <div className="flex-1 space-y-2">
        <header className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{comment.authorName}</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${PLATFORM_COLOR[comment.platform]}`}>
            {comment.platform}
          </span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATUS_COLOR[comment.status]}`}>
            {comment.status}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">{created}</span>
        </header>

        <p className="whitespace-pre-wrap text-sm">{comment.text}</p>

        {comment.mediaUrl && (
          <a href={comment.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
            Xem media gốc
          </a>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>♥ {comment.likeCount}</span>
          <span>💬 {comment.replyCount}</span>
        </div>

        {comment.replyText && (
          <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
            <p className="mb-1 font-semibold">Đã reply:</p>
            <p className="whitespace-pre-wrap">{comment.replyText}</p>
          </div>
        )}

        <footer className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => setReplyOpen(true)}
            disabled={busy}
            className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {comment.status === 'REPLIED' ? 'Reply lại' : 'Reply'}
          </button>
          <button
            type="button"
            onClick={() => mark.mutate({ action: 'read' })}
            disabled={busy}
            className="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
          >
            Đánh dấu đã đọc
          </button>
          <button
            type="button"
            onClick={() => mark.mutate({ action: 'ignore' })}
            disabled={busy}
            className="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
          >
            Bỏ qua
          </button>
          <button
            type="button"
            onClick={() => mark.mutate({ action: 'spam' })}
            disabled={busy}
            className="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
          >
            Spam
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="ml-auto text-xs text-destructive hover:underline disabled:opacity-50"
          >
            Xoá
          </button>
        </footer>
      </div>

      <ReplyDialog
        open={replyOpen}
        onClose={() => setReplyOpen(false)}
        commentId={comment.id}
        authorName={comment.authorName}
      />
    </article>
  )
}
