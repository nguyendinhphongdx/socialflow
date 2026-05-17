import { StatusView } from '@/features/status'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({
  title: 'Status',
  description: 'Trạng thái hệ thống Sociflow — uptime, sự cố và bảo trì.',
  path: '/status',
})

export const revalidate = 60

export default function Page() {
  return <StatusView />
}
