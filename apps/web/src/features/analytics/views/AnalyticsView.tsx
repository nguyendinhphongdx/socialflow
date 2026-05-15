'use client'
import { useMemo, useState } from 'react'
import { useAccounts } from '@/features/accounts'
import { MetricCard } from '../components/MetricCard'
import { TimelineChart } from '../components/TimelineChart'
import { useAccountTimeline } from '../hooks/useAnalytics'

const DAY_OPTIONS = [7, 30, 90] as const

export function AnalyticsView() {
  const { data: accounts } = useAccounts({ pageSize: 100 })
  const [accountId, setAccountId] = useState('')
  const [days, setDays] = useState<number>(30)

  const { data: timeline, isLoading } = useAccountTimeline(accountId || undefined, days)

  const summary = useMemo(() => {
    const list = timeline?.list ?? []
    if (!list.length) {
      return { latestFollowers: 0, totalEngagement: 0, totalPosts: 0, avgEngagement: 0, followersDelta: 0 }
    }
    const latest = list[list.length - 1]
    const totalEngagement = list.reduce((sum, p) => sum + p.totalEngagement, 0)
    const totalPosts = list.reduce((sum, p) => sum + p.totalPosts, 0)
    const followersDelta = list.reduce((sum, p) => sum + p.followersDelta, 0)
    return {
      latestFollowers: latest.followers,
      totalEngagement,
      totalPosts,
      avgEngagement: totalPosts > 0 ? Math.round(totalEngagement / totalPosts) : 0,
      followersDelta,
    }
  }, [timeline])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Followers, engagement, reach theo timeline</p>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-sm font-medium" htmlFor="account">Tài khoản</label>
          <select
            id="account"
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Chọn tài khoản...</option>
            {accounts?.list.map(a => (
              <option key={a.id} value={a.id}>{a.platform} · {a.displayName}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="days">Khoảng thời gian</label>
          <select
            id="days"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {DAY_OPTIONS.map(d => <option key={d} value={d}>{d} ngày</option>)}
          </select>
        </div>
      </section>

      {!accountId && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Chọn tài khoản để xem analytics</p>
        </div>
      )}

      {accountId && isLoading && <p className="text-muted-foreground">Đang tải...</p>}

      {accountId && timeline && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Followers (mới nhất)" value={summary.latestFollowers} delta={summary.followersDelta} />
            <MetricCard label="Tổng engagement" value={summary.totalEngagement} />
            <MetricCard label="Tổng posts" value={summary.totalPosts} />
            <MetricCard label="Engagement / post" value={summary.avgEngagement} />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Timeline</h2>
            <TimelineChart data={timeline.list} />
          </section>
        </>
      )}
    </div>
  )
}
