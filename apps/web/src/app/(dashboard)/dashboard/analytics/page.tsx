import { AnalyticsView } from '@/features/analytics'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Analytics', path: '/dashboard/analytics', noIndex: true })

export default function AnalyticsPage() {
  return <AnalyticsView />
}
