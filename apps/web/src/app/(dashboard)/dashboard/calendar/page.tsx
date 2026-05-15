import { CalendarView } from '@/features/calendar'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Calendar', path: '/dashboard/calendar', noIndex: true })

export default function CalendarPage() {
  return <CalendarView />
}
