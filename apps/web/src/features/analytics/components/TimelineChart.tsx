'use client'
import dynamic from 'next/dynamic'
import type { FC } from 'react'
import type { AccountTimelinePoint } from '../types'

interface TimelineChartProps {
  data: AccountTimelinePoint[]
}

const LineChart = dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false })
const Line = dynamic(() => import('recharts').then(m => m.Line), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false })
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })

export const TimelineChart: FC<TimelineChartProps> = ({ data }) => {
  if (!data.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        Chưa có dữ liệu timeline
      </div>
    )
  }

  const chartData = data.map(p => ({
    date: new Date(p.date).toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' }),
    followers: p.followers,
    engagement: p.totalEngagement,
    reach: p.reach,
  }))

  return (
    <div className="h-80 w-full rounded-lg border border-border bg-card p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" fontSize={12} stroke="hsl(var(--muted-foreground))" />
          <YAxis yAxisId="left" fontSize={12} stroke="hsl(var(--muted-foreground))" />
          <YAxis yAxisId="right" orientation="right" fontSize={12} stroke="hsl(var(--muted-foreground))" />
          <Tooltip />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="followers" stroke="#3b82f6" strokeWidth={2} dot={false} name="Followers" />
          <Line yAxisId="right" type="monotone" dataKey="engagement" stroke="#10b981" strokeWidth={2} dot={false} name="Engagement" />
          <Line yAxisId="right" type="monotone" dataKey="reach" stroke="#f59e0b" strokeWidth={2} dot={false} name="Reach" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
