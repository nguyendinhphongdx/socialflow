import { BrandMonitorView } from '@/features/brand-monitor'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({
  title: 'Brand monitor',
  path: '/dashboard/brand-monitor',
  noIndex: true,
})

export default function BrandMonitorPage() {
  return <BrandMonitorView />
}
