'use client'
import { useState, type FC } from 'react'
import { useAckBrandMention, useArchiveBrandMention, useBrandMentions } from '../hooks/useBrandMentions'
import type { BrandMention, MentionStatus, SentimentLabel } from '../types'
import { SentimentBadge } from './SentimentBadge'

interface BrandMentionListProps {
  monitorId?: string
}

const SENTIMENT_FILTERS: Array<{ label: string, value: SentimentLabel | undefined }> = [
  { label: 'Tất cả', value: undefined },
  { label: 'Tích cực', value: 'POSITIVE' },
  { label: 'Tiêu cực', value: 'NEGATIVE' },
  { label: 'Trung tính', value: 'NEUTRAL' },
]

const STATUS_FILTERS: Array<{ label: string, value: MentionStatus | undefined }> = [
  { label: 'Tất cả', value: undefined },
  { label: 'Mới', value: 'NEW' },
  { label: 'Đã xem', value: 'ACKED' },
  { label: 'Lưu trữ', value: 'ARCHIVED' },
]

export const BrandMentionList: FC<BrandMentionListProps> = ({ monitorId }) => {
  const [sentiment, setSentiment] = useState<SentimentLabel | undefined>(undefined)
  const [status, setStatus] = useState<MentionStatus | undefined>('NEW')
  const { data, isLoading } = useBrandMentions({ monitorId, sentiment, status, pageSize: 50 })

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SENTIMENT_FILTERS.map(f => (
          <button
            key={f.label}
            type="button"
            onClick={() => setSentiment(f.value)}
            className={`rounded-md border px-3 py-1 text-xs ${sentiment === f.value ? 'border-primary bg-primary/10' : 'border-input'}`}
          >
            {f.label}
          </button>
        ))}
        <span className="mx-2 text-muted-foreground">|</span>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.label}
            type="button"
            onClick={() => setStatus(f.value)}
            className={`rounded-md border px-3 py-1 text-xs ${status === f.value ? 'border-primary bg-primary/10' : 'border-input'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-muted-foreground">Đang tải...</p>}

      {!isLoading && data && data.list.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Chưa có mention nào khớp filter</p>
        </div>
      )}

      {data && data.list.length > 0 && (
        <ul className="space-y-2">
          {data.list.map(m => <MentionCard key={m.id} mention={m} />)}
        </ul>
      )}
    </section>
  )
}

const MentionCard: FC<{ mention: BrandMention }> = ({ mention }) => {
  const ack = useAckBrandMention()
  const archive = useArchiveBrandMention()
  const busy = ack.isPending || archive.isPending

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <header className="mb-2 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{mention.authorName ?? 'Unknown'}</span>
          <span>·</span>
          <span>{mention.platform}</span>
          {mention.postedAt && (
            <>
              <span>·</span>
              <span>{new Date(mention.postedAt).toLocaleString('vi-VN')}</span>
            </>
          )}
        </div>
        <SentimentBadge sentiment={mention.sentiment} score={mention.sentimentScore} />
      </header>

      <p className="whitespace-pre-wrap text-sm">{mention.text}</p>

      {mention.matchedKeywords.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {mention.matchedKeywords.map(k => (
            <span key={k} className="rounded-md bg-muted px-2 py-0.5 text-xs">#{k}</span>
          ))}
        </div>
      )}

      <footer className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-3 text-xs">
          {mention.permalink && (
            <a
              href={mention.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Xem trên platform ↗
            </a>
          )}
          <span className="text-muted-foreground">Status: {mention.status}</span>
        </div>
        <div className="flex items-center gap-2">
          {mention.status === 'NEW' && (
            <button
              type="button"
              onClick={() => ack.mutate(mention.id)}
              disabled={busy}
              className="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              Đánh dấu đã xem
            </button>
          )}
          {mention.status !== 'ARCHIVED' && (
            <button
              type="button"
              onClick={() => archive.mutate(mention.id)}
              disabled={busy}
              className="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              Lưu trữ
            </button>
          )}
        </div>
      </footer>
    </li>
  )
}
