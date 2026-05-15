'use client'
import type { FC } from 'react'
import Link from 'next/link'
import { useDeleteRule, useToggleRule } from '../hooks/useAutoReply'
import type { AutoReplyRule } from '../types'

export const RuleCard: FC<{ rule: AutoReplyRule }> = ({ rule }) => {
  const toggle = useToggleRule()
  const remove = useDeleteRule()
  const busy = toggle.isPending || remove.isPending

  function onDelete() {
    if (!confirm('Xoá rule này?')) return
    remove.mutate(rule.id)
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h3 className="font-semibold">{rule.name}</h3>
          <p className="text-xs text-muted-foreground">
            {rule.platforms.length > 0 ? rule.platforms.join(', ') : 'Tất cả platform'}
            {' · '}
            {rule.accountIds.length > 0 ? `${rule.accountIds.length} account` : 'Tất cả account'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggle.mutate(rule.id)}
          disabled={busy}
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'} disabled:opacity-50`}
        >
          {rule.enabled ? 'ON' : 'OFF'}
        </button>
      </header>

      <div className="space-y-1 text-xs">
        {rule.keywordsAny.length > 0 && (
          <p><span className="font-semibold">Any:</span> {rule.keywordsAny.join(', ')}</p>
        )}
        {rule.keywordsAll.length > 0 && (
          <p><span className="font-semibold">All:</span> {rule.keywordsAll.join(', ')}</p>
        )}
        {rule.keywordsNone.length > 0 && (
          <p><span className="font-semibold">None:</span> {rule.keywordsNone.join(', ')}</p>
        )}
      </div>

      <div className="rounded-md bg-muted/50 p-2 text-xs">
        <p className="line-clamp-2 whitespace-pre-wrap">{rule.replyTemplate}</p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <dt className="text-muted-foreground">Match</dt>
          <dd className="font-semibold">{rule.matchCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reply</dt>
          <dd className="font-semibold">{rule.replyCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Quota/day</dt>
          <dd className="font-semibold">{rule.maxRepliesPerDay}</dd>
        </div>
      </dl>

      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <Link
          href={`/dashboard/auto-reply/${rule.id}`}
          className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent"
        >
          Sửa
        </Link>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="text-xs text-destructive hover:underline disabled:opacity-50"
        >
          Xoá
        </button>
      </footer>
    </article>
  )
}
