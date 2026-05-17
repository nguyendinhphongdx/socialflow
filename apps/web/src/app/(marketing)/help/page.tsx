import { HelpView } from '@/features/help'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({
  title: 'Help Center',
  description: 'Trung tâm trợ giúp Sociflow — hướng dẫn, FAQ và liên hệ hỗ trợ.',
  path: '/help',
})

export default function Page() {
  return <HelpView />
}
