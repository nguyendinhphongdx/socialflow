import { InboxView } from '@/features/inbox'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Inbox', path: '/dashboard/inbox', noIndex: true })

export default function InboxPage() {
  return <InboxView />
}
