import { PublishListView } from '@/features/publish'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Publish', path: '/dashboard/publish', noIndex: true })

export default function PublishPage() {
  return <PublishListView />
}
