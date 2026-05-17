import type { FC } from 'react'
import type { SentimentLabel } from '../types'

interface SentimentBadgeProps {
  sentiment: SentimentLabel | null
  score?: number | null
}

const STYLES: Record<SentimentLabel, string> = {
  POSITIVE: 'bg-green-100 text-green-800 border-green-200',
  NEGATIVE: 'bg-red-100 text-red-800 border-red-200',
  NEUTRAL: 'bg-yellow-100 text-yellow-800 border-yellow-200',
}

const LABELS: Record<SentimentLabel, string> = {
  POSITIVE: 'Tích cực',
  NEGATIVE: 'Tiêu cực',
  NEUTRAL: 'Trung tính',
}

export const SentimentBadge: FC<SentimentBadgeProps> = ({ sentiment, score }) => {
  if (!sentiment) {
    return (
      <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
        Đang phân tích...
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${STYLES[sentiment]}`}>
      <span>{LABELS[sentiment]}</span>
      {typeof score === 'number' && (
        <span className="text-[10px] opacity-70">{Math.round(score * 100)}%</span>
      )}
    </span>
  )
}
