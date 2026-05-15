import { ComposeView } from '@/features/compose'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Compose', path: '/dashboard/compose', noIndex: true })

export default function ComposePage() {
  return <ComposeView />
}
