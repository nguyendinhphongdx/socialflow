'use client'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { type EventClickArg } from '@fullcalendar/interaction'
import { usePublishList, type PublishRecord } from '@/features/publish'

const STATUS_COLOR: Record<PublishRecord['status'], string> = {
  PENDING: '#9ca3af',
  SCHEDULED: '#3b82f6',
  WAITING_AGENT: '#6366f1',
  DISPATCHED: '#6366f1',
  IN_PROGRESS: '#6366f1',
  REVIEW_PENDING: '#eab308',
  PUBLISHED: '#10b981',
  FAILED: '#ef4444',
  CANCELLED: '#6b7280',
  REJECTED: '#ef4444',
}

export function CalendarView() {
  const router = useRouter()
  const { data } = usePublishList({ pageSize: 200 })

  const events = useMemo(() => {
    return (data?.list ?? []).map(r => ({
      id: r.id,
      title: `[${r.accountPlatform}] ${r.title ?? '(no title)'}`,
      start: r.publishTime,
      end: r.publishedAt ?? undefined,
      backgroundColor: STATUS_COLOR[r.status],
      borderColor: STATUS_COLOR[r.status],
      extendedProps: { record: r },
    }))
  }, [data])

  function onEventClick(arg: EventClickArg) {
    router.push(`/dashboard/publish?flowId=${arg.event.extendedProps.record.flowId ?? arg.event.id}`)
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lịch publish</h1>
      </header>

      <div className="rounded-lg border border-border bg-card p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          eventClick={onEventClick}
          height="auto"
          locale="vi"
          firstDay={1}
        />
      </div>
    </div>
  )
}
