'use client'
import type { FC } from 'react'
import { useCancelPublish } from '../hooks/usePublish'
import type { PublishRecord } from '../types'

const STATUS_COLOR: Record<PublishRecord['status'], string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  WAITING_AGENT: 'bg-blue-100 text-blue-800',
  DISPATCHED: 'bg-indigo-100 text-indigo-800',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
  REVIEW_PENDING: 'bg-yellow-100 text-yellow-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  REJECTED: 'bg-red-100 text-red-800',
}

export const PublishRow: FC<{ record: PublishRecord }> = ({ record }) => {
  const cancel = useCancelPublish()
  const canCancel = !['PUBLISHED', 'CANCELLED', 'REJECTED', 'FAILED'].includes(record.status)

  return (
    <tr className="border-b border-border hover:bg-accent/50">
      <td className="px-3 py-2 text-sm font-medium">{record.title ?? '(không tiêu đề)'}</td>
      <td className="px-3 py-2 text-sm">{record.accountPlatform} · {record.accountDisplayName}</td>
      <td className="px-3 py-2 text-sm">
        <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_COLOR[record.status]}`}>
          {record.status}
        </span>
        {record.stage && <span className="ml-2 text-xs text-muted-foreground">{record.stage}</span>}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {new Date(record.publishTime).toLocaleString('vi-VN')}
      </td>
      <td className="px-3 py-2 text-xs">
        {record.workLink
          ? <a href={record.workLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Xem</a>
          : record.errorMessage
            ? <span className="text-destructive">Lỗi</span>
            : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2 text-right">
        {canCancel && (
          <button
            type="button"
            onClick={() => cancel.mutate(record.id)}
            disabled={cancel.isPending}
            className="text-xs text-destructive hover:underline"
          >
            Huỷ
          </button>
        )}
      </td>
    </tr>
  )
}
