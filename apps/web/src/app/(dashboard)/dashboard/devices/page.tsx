import { DevicesView } from '@/features/devices'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Thiết bị', path: '/dashboard/devices', noIndex: true })

export default function DevicesPage() {
  return <DevicesView />
}
