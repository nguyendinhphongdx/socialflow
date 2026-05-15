import { DraftListView } from '@/features/drafts'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Bản nháp', path: '/dashboard/drafts', noIndex: true })

export default function DraftsPage() {
  return <DraftListView />
}
