import { DraftFormView } from '@/features/drafts'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Tạo bản nháp', path: '/dashboard/drafts/new', noIndex: true })

export default function NewDraftPage() {
  return <DraftFormView />
}
