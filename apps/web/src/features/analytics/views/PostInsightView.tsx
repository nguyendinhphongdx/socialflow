'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { MetricCard } from '../components/MetricCard'
import { usePostInsights, useSnapshotPostNow } from '../hooks/useAnalytics'
import type { PostInsight } from '../types'

interface PostInsightViewProps {
  publishRecordId: string
}

interface SnapshotRow extends PostInsight {
  viewsDelta: number
  likesDelta: number
  commentsDelta: number
  sharesDelta: number
}

function computeDeltas(list: PostInsight[]): SnapshotRow[] {
  const sorted = [...list].sort(
    (a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime(),
  )
  return sorted.map((cur, i) => {
    const prev = i > 0 ? sorted[i - 1] : null
    return {
      ...cur,
      viewsDelta: prev ? cur.views - prev.views : cur.views,
      likesDelta: prev ? cur.likes - prev.likes : cur.likes,
      commentsDelta: prev ? cur.comments - prev.comments : cur.comments,
      sharesDelta: prev ? cur.shares - prev.shares : cur.shares,
    }
  })
}

export function PostInsightView({ publishRecordId }: PostInsightViewProps) {
  const { data: insights, isLoading } = usePostInsights(publishRecordId)
  const snapshot = useSnapshotPostNow(publishRecordId)

  const rows = useMemo(() => computeDeltas(insights ?? []), [insights])
  const latest = rows.length > 0 ? rows[rows.length - 1] : null
  const prev = rows.length > 1 ? rows[rows.length - 2] : null

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Post insights</h1>
          <p className="text-sm text-muted-foreground">Lịch sử snapshot metrics của bài</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/analytics"
            className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
          >
            ← Analytics
          </Link>
          <button
            type="button"
            onClick={() => snapshot.mutate()}
            disabled={snapshot.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {snapshot.isPending ? 'Đang snapshot...' : 'Snapshot ngay'}
          </button>
        </div>
      </header>

      {isLoading && <p className="text-muted-foreground">Đang tải...</p>}

      {!isLoading && !latest && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Chưa có insight nào. Bấm "Snapshot ngay" để fetch lần đầu.</p>
        </div>
      )}

      {latest && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Views"
              value={latest.views}
              delta={prev ? latest.views - prev.views : null}
            />
            <MetricCard
              label="Likes"
              value={latest.likes}
              delta={prev ? latest.likes - prev.likes : null}
            />
            <MetricCard
              label="Comments"
              value={latest.comments}
              delta={prev ? latest.comments - prev.comments : null}
            />
            <MetricCard
              label="Shares"
              value={latest.shares}
              delta={prev ? latest.shares - prev.shares : null}
            />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Lịch sử snapshot</h2>
            <table className="w-full border-collapse rounded-lg border border-border text-sm">
              <thead>
                <tr className="bg-muted text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Snapshot at</th>
                  <th className="px-3 py-2">Views</th>
                  <th className="px-3 py-2">Likes</th>
                  <th className="px-3 py-2">Comments</th>
                  <th className="px-3 py-2">Shares</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map(r => (
                  <tr key={r.id} className="border-b border-border">
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(r.snapshotAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-3 py-2">{r.views} <DeltaPill v={r.viewsDelta} /></td>
                    <td className="px-3 py-2">{r.likes} <DeltaPill v={r.likesDelta} /></td>
                    <td className="px-3 py-2">{r.comments} <DeltaPill v={r.commentsDelta} /></td>
                    <td className="px-3 py-2">{r.shares} <DeltaPill v={r.sharesDelta} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}

function DeltaPill({ v }: { v: number }) {
  if (v === 0) return null
  const cls = v > 0 ? 'text-green-700' : 'text-red-700'
  return <span className={`ml-1 text-xs ${cls}`}>({v > 0 ? '+' : ''}{v})</span>
}
