import { RuleListView } from '@/features/auto-reply'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Auto-reply rules', path: '/dashboard/auto-reply', noIndex: true })

export default function AutoReplyPage() {
  return <RuleListView />
}
