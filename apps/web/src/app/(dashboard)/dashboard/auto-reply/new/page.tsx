import { RuleFormView } from '@/features/auto-reply'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Tạo rule', path: '/dashboard/auto-reply/new', noIndex: true })

export default function NewAutoReplyPage() {
  return <RuleFormView />
}
